"""
Autenticación — hashing de contraseñas y manejo de JWT.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db, Usuario

# --- Configuración ---
SECRET_KEY = "CAMBIAR_ESTA_CLAVE_POR_UNA_SEGURA"  # TODO: mover a variable de entorno antes de producción
ALGORITHM = "HS256"
HORAS_EXPIRACION = 12

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


def verificar_password(password_plano: str, password_hash: str) -> bool:
    return pwd_context.verify(password_plano, password_hash)


def hashear_password(password_plano: str) -> str:
    return pwd_context.hash(password_plano)


def crear_token(correo: str, rol: str, sede: Optional[str]) -> str:
    expira = datetime.utcnow() + timedelta(hours=HORAS_EXPIRACION)
    payload = {"sub": correo, "rol": rol, "sede": sede, "exp": expira}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decodificar_y_buscar(token: str, db: Session) -> Usuario:
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesión inválida o expirada. Vuelve a iniciar sesión.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        correo = payload.get("sub")
        if correo is None:
            raise credenciales_invalidas
    except JWTError:
        raise credenciales_invalidas

    usuario = db.query(Usuario).filter(Usuario.correo == correo).first()
    if usuario is None or not usuario.activo:
        raise credenciales_invalidas
    return usuario


def obtener_usuario_actual(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Usuario:
    """Uso normal: el token viaja en el header Authorization (todas las llamadas de api.js pasan por acá)."""
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado", headers={"WWW-Authenticate": "Bearer"})
    return _decodificar_y_buscar(token, db)


def obtener_usuario_para_descarga(
    token_header: Optional[str] = Depends(oauth2_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Igual que obtener_usuario_actual, pero también acepta el token como
    ?token=... en la URL. Se usa solo en endpoints que el navegador abre
    directo (como la descarga del Excel), donde no se puede mandar el
    header Authorization.
    """
    valor = token_header or token_query
    if not valor:
        raise HTTPException(status_code=401, detail="No autenticado")
    return _decodificar_y_buscar(valor, db)


def requerir_admin(usuario: Usuario = Depends(obtener_usuario_actual)) -> Usuario:
    if usuario.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta acción es solo para Sistemas de Gestión (admin).",
        )
    return usuario


def requerir_admin_descarga(usuario: Usuario = Depends(obtener_usuario_para_descarga)) -> Usuario:
    if usuario.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta acción es solo para Sistemas de Gestión (admin).",
        )
    return usuario