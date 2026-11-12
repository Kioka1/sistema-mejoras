"""Contraseñas y sesiones opacas, revocables en la base de datos."""
from hashlib import sha256
from hmac import compare_digest, digest
import os
import re
from secrets import token_urlsafe
import time

from fastapi import Depends, HTTPException, Request, Response
from passlib.context import CryptContext
from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from config_seguridad import COOKIE_SESION, OPCIONES_COOKIE
from database import get_db, SesionUsuario, Usuario
from seguridad_http import limitar

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()
if len(SECRET_KEY) < 32 or SECRET_KEY == "CAMBIAR_ESTA_CLAVE_POR_UNA_SEGURA":
    raise RuntimeError("Configura JWT_SECRET_KEY con una clave privada aleatoria de al menos 32 caracteres.")

DURACION_SESION = 8 * 3600
INACTIVIDAD_SESION = 30 * 60
FORMATO_TOKEN = re.compile(r"[A-Za-z0-9_-]{43}")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
HASH_FICTICIO = pwd_context.hash(token_urlsafe(32))


def verificar_password(password_plano: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password_plano, password_hash)
    except (ValueError, TypeError):
        return False


def hashear_password(password_plano: str) -> str:
    return pwd_context.hash(password_plano)


def _clave(token: str) -> str:
    return digest(SECRET_KEY.encode(), token.encode(), "sha256").hex()


def _credencial(usuario: Usuario) -> str:
    return sha256(usuario.password_hash.encode()).hexdigest()


def limpiar_sesiones_vencidas(db: Session, ahora: int):
    db.execute(delete(SesionUsuario).where(
        (SesionUsuario.expira <= ahora) | (SesionUsuario.ultima_actividad <= ahora - INACTIVIDAD_SESION)
    ))


def revocar_sesion(request: Request, db: Session):
    token = request.cookies.get(COOKIE_SESION, "")
    if FORMATO_TOKEN.fullmatch(token):
        db.execute(delete(SesionUsuario).where(SesionUsuario.clave == _clave(token)))


def iniciar_sesion(request: Request, response: Response, usuario: Usuario, db: Session):
    ahora = int(time.time())
    token = token_urlsafe(32)
    revocar_sesion(request, db)
    db.add(SesionUsuario(clave=_clave(token), usuario_id=usuario.id, credencial=_credencial(usuario),
                         expira=ahora + DURACION_SESION, ultima_actividad=ahora))
    db.commit()
    response.set_cookie(COOKIE_SESION, token, **OPCIONES_COOKIE)


def cerrar_sesion(request: Request, response: Response, db: Session):
    revocar_sesion(request, db)
    db.commit()
    response.delete_cookie(COOKIE_SESION, **OPCIONES_COOKIE)


def revocar_sesiones_usuario(usuario_id: int, db: Session):
    db.execute(delete(SesionUsuario).where(SesionUsuario.usuario_id == usuario_id))


def obtener_usuario_actual(request: Request, db: Session = Depends(get_db)) -> Usuario:
    token = request.cookies.get(COOKIE_SESION, "")
    ahora = int(time.time())
    sesion = db.get(SesionUsuario, _clave(token)) if FORMATO_TOKEN.fullmatch(token) else None
    usuario = sesion.usuario if sesion else None
    if (not usuario or not usuario.activo or usuario.rol not in {"admin", "usuario"}
            or sesion.expira <= ahora or sesion.ultima_actividad <= ahora - INACTIVIDAD_SESION
            or not compare_digest(sesion.credencial, _credencial(usuario))):
        raise HTTPException(401, "Sesión inválida o expirada. Vuelve a iniciar sesión.")

    if request.url.path == "/api/auth/logout":
        return usuario
    limitar("usuario", usuario.id, 180)
    # Las consultas de fondo son GET. Solo las acciones y el pulso de actividad renuevan el plazo.
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and sesion.ultima_actividad < ahora - 30:
        db.execute(update(SesionUsuario).where(SesionUsuario.clave == sesion.clave,
                   SesionUsuario.ultima_actividad < ahora).values(ultima_actividad=ahora))
        db.commit()
    return usuario


def requerir_admin(usuario: Usuario = Depends(obtener_usuario_actual)) -> Usuario:
    if usuario.rol != "admin":
        raise HTTPException(403, "Esta acción es solo para Sistemas de Gestión (admin).")
    return usuario
