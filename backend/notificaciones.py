"""
Envío de notificaciones por correo (Gmail SMTP).
Si las variables de entorno SMTP_USER / SMTP_PASSWORD no están
configuradas, se conserva el aviso interno sin enviar correo.
"""
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from seguridad_http import logger

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "Sistema de Mejoras - Unifranz")


def enviar_correo(destinatario: str, asunto: str, mensaje: str):
    if not destinatario or "@" not in destinatario or "\r" in destinatario or "\n" in destinatario:
        logger.warning("Se omitió un correo con destinatario inválido.")
        return

    if not SMTP_USER or not SMTP_PASSWORD:
        return

    try:
        cuerpo = MIMEText(mensaje, "plain", "utf-8")
        cuerpo["Subject"] = asunto
        cuerpo["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
        cuerpo["To"] = destinatario

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10, context=ssl.create_default_context()) as servidor:
            servidor.login(SMTP_USER, SMTP_PASSWORD)
            servidor.sendmail(SMTP_USER, [destinatario], cuerpo.as_string())
    except (OSError, ValueError, smtplib.SMTPException) as error:
        logger.warning("No se pudo enviar una notificación por correo (%s).", type(error).__name__)
