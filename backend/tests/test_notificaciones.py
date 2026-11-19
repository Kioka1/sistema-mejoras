"""Correos institucionales sin conexiones ni envíos reales."""
import unittest
from email import policy
from email.parser import BytesParser
from unittest.mock import patch
import test_regresiones  # Prepara el entorno aislado antes de importar el backend.
import notificaciones


class CorreosInstitucionales(unittest.TestCase):
    @patch.object(notificaciones, "SMTP_USER", "remitente@example.invalid")
    @patch.object(notificaciones, "SISTEMA_URL", "https://mejoras.example.invalid/")
    def test_firma_utf8_logo_integrado_y_contenido_seguro(self):
        correo = notificaciones.crear_mensaje(
            "ti@example.invalid", "Nueva Acción — AM BS-EA-01-26",
            'Hallazgo: <script>alert("prueba")</script>\nFecha límite: 2026-11-20',
        )
        parsed = BytesParser(policy=policy.default).parsebytes(correo.as_bytes())
        texto = parsed.get_body(("plain",)).get_content()
        html = parsed.get_body(("html",)).get_content()
        for dato in ("Abigail E. Arancibia Vásquez", "Coordinadora Sistema de Gestión",
                     "Management System Coordinator", "Universidad Privada Franz Tamayo - UNIFRANZ",
                     "El Alto - Bolivia", "5017", "abigail.arancibia@unifranz.edu.bo",
                     "El medio ambiente es cuestión de todos"):
            self.assertIn(dato, texto)
            self.assertIn(dato, html)
        self.assertIn("&lt;script&gt;", html)
        self.assertNotIn("<script>", html)
        self.assertIn('href="https://mejoras.example.invalid/"', html)
        self.assertNotIn("docs.google.com", html)
        self.assertNotIn("googleusercontent.com", html)
        self.assertIn('src="cid:firma-unifranz"', html)
        imagenes = [p for p in parsed.walk() if p.get_content_type() == "image/png"]
        self.assertEqual(len(imagenes), 1)
        self.assertEqual(imagenes[0]["Content-ID"], "<firma-unifranz>")
        self.assertTrue(imagenes[0].get_payload(decode=True).startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertIn("remitente@example.invalid", parsed["From"])
        self.assertEqual(parsed["Reply-To"], "abigail.arancibia@unifranz.edu.bo")

    @patch.object(notificaciones, "SMTP_USER", "remitente@example.invalid")
    @patch.object(notificaciones, "SISTEMA_URL", 'javascript:alert("prueba")')
    def test_no_incluye_enlaces_de_configuracion_invalidos(self):
        html = notificaciones.crear_mensaje("ti@example.invalid", "Aviso", "Pendiente").get_body(("html",)).get_content()
        self.assertNotIn("javascript:", html)

    @patch.object(notificaciones.smtplib, "SMTP_SSL")
    @patch.object(notificaciones, "SMTP_USER", "remitente@example.invalid")
    @patch.object(notificaciones, "SMTP_PASSWORD", "solo-para-prueba")
    def test_envio_usa_cuenta_autenticada_y_firma(self, smtp):
        notificaciones.enviar_correo("ti@example.invalid", "Acción pendiente", "Completa el formulario.")
        servidor = smtp.return_value.__enter__.return_value
        servidor.login.assert_called_once_with("remitente@example.invalid", "solo-para-prueba")
        remitente, destinatarios, contenido = servidor.sendmail.call_args.args
        self.assertEqual(remitente, "remitente@example.invalid")
        self.assertEqual(destinatarios, ["ti@example.invalid"])
        self.assertIn("multipart/alternative", contenido)
        self.assertIn("multipart/related", contenido)

    @patch.object(notificaciones.smtplib, "SMTP_SSL")
    @patch.object(notificaciones, "SMTP_PASSWORD", "")
    def test_sin_credenciales_no_intenta_enviar(self, smtp):
        notificaciones.enviar_correo("ti@example.invalid", "Aviso", "Pendiente")
        smtp.assert_not_called()
