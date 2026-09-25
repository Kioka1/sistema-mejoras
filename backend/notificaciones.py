"""
Envío de notificaciones por correo (Gmail SMTP).
Si las variables de entorno SMTP_USER / SMTP_PASSWORD no están
configuradas, no falla — solo deja el aviso en la consola, para que el
sistema siga funcionando en desarrollo sin necesidad de credenciales.
"""
import os
import smtplib
from email.mime.text import MIMEText

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "Sistema de Mejoras - Unifranz")


def enviar_correo(destinatario: str, asunto: str, mensaje: str):
    if not destinatario or "@" not in destinatario:
        print(f"[NOTIFICACIÓN] Destinatario inválido, no se envía: {destinatario!r} — {mensaje}")
        return

    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[NOTIFICACIÓN SIMULADA — falta configurar correo (SMTP_USER/SMTP_PASSWORD)] Para: {destinatario} — {mensaje}")
        return

    try:
        cuerpo = MIMEText(mensaje, "plain", "utf-8")
        cuerpo["Subject"] = asunto
        cuerpo["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
        cuerpo["To"] = destinatario

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as servidor:
            servidor.login(SMTP_USER, SMTP_PASSWORD)
            servidor.sendmail(SMTP_USER, [destinatario], cuerpo.as_string())
        print(f"[CORREO ENVIADO] Para: {destinatario}")
    except Exception as e:
        print(f"[ERROR AL ENVIAR CORREO] Para: {destinatario} — {e}")