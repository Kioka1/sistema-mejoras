"""Configuración de seguridad compartida por la API y sus sesiones."""
import os
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

ORIGENES_LOCALES = {"http://localhost:5173", "http://127.0.0.1:5173"}
ORIGENES_WEB = {
    valor.strip() for valor in os.getenv("CORS_ORIGINS", ",".join(sorted(ORIGENES_LOCALES))).split(",")
    if valor.strip()
}
COOKIE_SEGURA = os.getenv("SESSION_COOKIE_SECURE", "true").lower() != "false"
for origen in ORIGENES_WEB:
    url = urlsplit(origen)
    if (url.scheme not in {"http", "https"} or not url.hostname or url.username is not None
            or url.path or url.query or url.fragment or "*" in origen
            or (url.scheme == "http" and url.hostname not in {"localhost", "127.0.0.1", "::1"})):
        raise RuntimeError("CORS_ORIGINS debe contener orígenes completos y exactos, sin rutas ni comodines.")
    if not COOKIE_SEGURA and url.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("SESSION_COOKIE_SECURE=false solo se permite para desarrollo local.")

COOKIE_SESION = "__Host-sgc_sesion" if COOKIE_SEGURA else "sgc_sesion_dev"
COOKIE_GOOGLE = "__Host-sgc_google" if COOKIE_SEGURA else "sgc_google_dev"
OPCIONES_COOKIE = {"secure": COOKIE_SEGURA, "httponly": True, "samesite": "strict", "path": "/"}
