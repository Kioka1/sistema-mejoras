"""
Envío de notificaciones por correo (Gmail SMTP).
Si las variables de entorno SMTP_USER / SMTP_PASSWORD no están
configuradas, se conserva el aviso interno sin enviar correo.
"""
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from pathlib import Path
from urllib.parse import urlsplit
from seguridad_http import logger

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "Abigail E. Arancibia Vásquez")
SMTP_REPLY_TO = os.environ.get("SMTP_REPLY_TO", "abigail.arancibia@unifranz.edu.bo")
SISTEMA_URL = os.environ.get("SISTEMA_URL", "").strip()
PLANTILLAS = Path(__file__).resolve().parent / "templates"
FIRMA_TEXTO = '''Abigail E. Arancibia Vásquez
Coordinadora Sistema de Gestión
Management System Coordinator
Universidad Privada Franz Tamayo - UNIFRANZ

El Alto - Bolivia
Dirección: Av. del Aeropuerto Internacional de El Alto N°1015
Teléfono: +(591) 2 - 2823421 - Int. 5017
e-mail: abigail.arancibia@unifranz.edu.bo

http://www.unifranz.edu.bo/

Antes de imprimir este correo electrónico.
Piense bien si es necesario hacerlo: "El medio ambiente es cuestión de todos"'''


def crear_mensaje(destinatario: str, asunto: str, mensaje: str) -> EmailMessage:
    """Arma el aviso institucional; no envía correo ni consulta servicios externos."""
    cuerpo = EmailMessage()
    cuerpo["Subject"] = asunto
    cuerpo["From"] = formataddr((SMTP_FROM_NAME, SMTP_USER))
    cuerpo["To"] = destinatario
    if SMTP_REPLY_TO:
        cuerpo["Reply-To"] = SMTP_REPLY_TO

    url = urlsplit(SISTEMA_URL)
    enlace = (SISTEMA_URL if url.scheme in {"http", "https"} and url.hostname
              and not url.username and not url.password else "")
    texto = f"Estimado(a):\n\n{mensaje}"
    if enlace:
        texto += f"\n\nIngresar al sistema: {enlace}"
    cuerpo.set_content(f"{texto}\n\n{FIRMA_TEXTO}")

    # Los datos de las acciones se escapan: nunca se interpretan como HTML.
    contenido = escape(texto).replace("\n", "<br>")
    if enlace:
        contenido = contenido.replace(escape(enlace), f'<a href="{escape(enlace, quote=True)}">{escape(enlace)}</a>')
    firma = (PLANTILLAS / "firma_correo.html").read_text(encoding="utf-8")
    cuerpo.add_alternative(
        '<!doctype html><html lang="es"><head><meta charset="utf-8"></head>'
        '<body style="font-family:Arial,sans-serif;font-size:14px;color:#222;background:#fff">'
        f'<div style="line-height:1.6">{contenido}</div><br><br>{firma}</body></html>',
        subtype="html",
    )
    cuerpo.get_payload()[-1].add_related(
        (PLANTILLAS / "firma_unifranz.png").read_bytes(),
        maintype="image", subtype="png", cid="<firma-unifranz>", disposition="inline",
    )
    return cuerpo


def enviar_correo(destinatario: str, asunto: str, mensaje: str):
    if not destinatario or "@" not in destinatario or "\r" in destinatario or "\n" in destinatario:
        logger.warning("Se omitió un correo con destinatario inválido.")
        return

    if not SMTP_USER or not SMTP_PASSWORD:
        return

    try:
        cuerpo = crear_mensaje(destinatario, asunto, mensaje)

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10, context=ssl.create_default_context()) as servidor:
            servidor.login(SMTP_USER, SMTP_PASSWORD)
            servidor.sendmail(SMTP_USER, [destinatario], cuerpo.as_string())
    except (OSError, ValueError, smtplib.SMTPException) as error:
        logger.warning("No se pudo enviar una notificación por correo (%s).", type(error).__name__)
