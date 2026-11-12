"""Límites de tráfico, protección de origen y respuestas HTTP de la API."""
from collections import deque
import logging
from threading import Lock
from time import monotonic
from uuid import uuid4

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers, MutableHeaders

from config_seguridad import COOKIE_SESION, ORIGENES_WEB

logger = logging.getLogger("sistema_mejoras")
METODOS_ESCRITURA = {"POST", "PUT", "PATCH", "DELETE"}
MAX_CUERPO = 1024 * 1024
MAX_MULTIPART = 16 * MAX_CUERPO
MAX_CLAVES = 20000
VENTANA = 60
_contadores = {}
_bloqueo = Lock()
_ultima_limpieza = 0


def limitar(grupo, identificador, maximo, ventana=VENTANA):
    global _ultima_limpieza
    ahora = monotonic()
    umbral = ahora - ventana
    clave = (grupo, identificador)
    with _bloqueo:
        if _ultima_limpieza <= ahora - VENTANA:
            for anterior, (tiempos, plazo) in list(_contadores.items()):
                if tiempos[-1] <= ahora - plazo:
                    del _contadores[anterior]
            _ultima_limpieza = ahora

        contador = _contadores.get(clave)
        if contador is None:
            if len(_contadores) >= MAX_CLAVES:
                raise HTTPException(429, "Demasiadas solicitudes. Intenta de nuevo en un minuto.",
                                    headers={"Retry-After": str(VENTANA)})
            contador = _contadores[clave] = (deque(), ventana)
        tiempos, _ = contador
        while tiempos and tiempos[0] <= umbral:
            tiempos.popleft()
        if len(tiempos) >= maximo:
            espera = max(1, int(tiempos[0] + ventana - ahora) + 1)
            raise HTTPException(429, "Demasiadas solicitudes. Intenta de nuevo más tarde.",
                                headers={"Retry-After": str(espera)})
        tiempos.append(ahora)


class SeguridadHTTP:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/api/"):
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        multipart = headers.get("content-type", "").lower().startswith("multipart/form-data;")
        maximo = MAX_MULTIPART if multipart else MAX_CUERPO
        recibidos = 0

        async def leer():
            nonlocal recibidos
            mensaje = await receive()
            recibidos += len(mensaje.get("body", b""))
            if recibidos > maximo:
                raise HTTPException(413, "La solicitud supera el tamaño permitido.")
            return mensaje

        iniciado = False

        async def responder(mensaje):
            nonlocal iniciado
            if mensaje["type"] == "http.response.start":
                iniciado = True
                salida = MutableHeaders(scope=mensaje)
                salida["Cache-Control"] = "no-store"
                salida["X-Content-Type-Options"] = "nosniff"
                salida["Referrer-Policy"] = "no-referrer"
                salida["X-Frame-Options"] = "DENY"
            await send(mensaje)

        try:
            ip = (scope.get("client") or ("desconocida", 0))[0]
            limitar("ip", ip, 600)
            if scope["path"].rstrip("/") in {"/api/auth/login", "/api/auth/google", "/api/auth/google/desafio"}:
                limitar("login-ip", ip, 30)

            if scope["method"] in METODOS_ESCRITURA and headers.get("origin") not in ORIGENES_WEB:
                raise HTTPException(403, "Origen de la solicitud no autorizado.")
            if multipart:
                limitar("archivos-ip", ip, 40)
                if not Request(scope).cookies.get(COOKIE_SESION):
                    raise HTTPException(401, "Sesión inválida o expirada. Vuelve a iniciar sesión.")
            longitud = headers.get("content-length")
            if longitud is not None and (not longitud.isascii() or not longitud.isdecimal() or len(longitud) > 20):
                raise HTTPException(400, "Tamaño de solicitud inválido.")
            if longitud is not None and int(longitud) > maximo:
                raise HTTPException(413, "La solicitud supera el tamaño permitido.")
            await self.app(scope, leer, responder)
        except HTTPException as error:
            if iniciado:
                raise
            await JSONResponse({"detail": error.detail}, error.status_code, headers=error.headers)(scope, receive, responder)
        except Exception as error:
            # El texto de una excepción puede incluir consultas, parámetros o credenciales.
            referencia = uuid4().hex
            logger.error("Error interno de API %s (%s)", referencia, type(error).__name__)
            if iniciado:
                raise
            await JSONResponse({"detail": "Ocurrió un error interno.", "referencia": referencia},
                               500)(scope, receive, responder)
