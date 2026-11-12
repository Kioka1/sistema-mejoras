"""Pruebas aisladas: SQLite en memoria, sin correo ni archivos reales."""
import os
import asyncio
import base64
from io import BytesIO
from zipfile import ZipFile
from xml.dom import minidom
from pathlib import Path
import secrets
import subprocess
import sys
import unittest
from datetime import date, timedelta
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(48)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main
from database import Base, engine, SessionLocal, Usuario, EvidenciaArchivo, asignar_areas
from fastapi import HTTPException
from fastapi import UploadFile
from evidencias import normalizar_nombre, validar_nombres, comprobar_archivo
from formulario_word import generar_formulario, PLANTILLA, W
from schemas import (
    AccionMejoraCreate, PlanAccionUpdate, PlanItemIn,
    ObservacionCreate, EvidenciaAsignar,
    VerificacionUpdate,
)


class Regresiones(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.correo = patch.object(main, "enviar_correo")
        self.correo.start()
        self.addCleanup(self.correo.stop)
        self.addCleanup(self.db.close)
        self.admin = Usuario(nombre_completo="Admin", correo="admin@test.local",
                             password_hash="sin login", rol="admin")
        self.usuario = Usuario(nombre_completo="Responsable", correo="area@test.local",
                               password_hash="sin login", rol="usuario")
        self.db.add_all([self.admin, self.usuario])
        self.db.flush()
        asignar_areas(self.db, self.usuario, ["TI"])
        self.db.commit()

    def plan(self, plazo):
        return PlanAccionUpdate(
            acciones=[PlanItemIn(accion="Corregir causa", evidencia="Informe")],
            analisis_causa_raiz="Causa identificada", responsables="Responsable",
            plazo_ejecucion=plazo.isoformat(),
        )

    def accion(self):
        return main.crear_accion(AccionMejoraCreate(
            declaracion_hallazgo="Hallazgo de prueba", areas=["TI"]
        ), self.db, self.admin)

    def test_correccion_permite_reasignar_y_reenviar_evidencia(self):
        accion = self.accion()
        plan = self.plan(date.today())
        accion = main.completar_plan_accion(accion.id, plan, self.db, self.usuario)
        archivo = EvidenciaArchivo(
            accion_id=accion.id, plan_item_id=accion.plan_items[0].id,
            nombre_original="informe.pdf", nombre_guardado="virtual.pdf", fecha=main._ahora(),
        )
        self.db.add(archivo)
        self.db.commit()
        self.db.expire_all()
        main.enviar_evidencia(accion.id, self.db, self.usuario)
        main.observar_accion(accion.id, ObservacionCreate(texto="Corregir plan"),
                             self.db, self.admin)
        accion = main.completar_plan_accion(accion.id, plan, self.db, self.usuario)
        self.assertEqual(accion.estado, "Pendiente de evidencia")
        self.assertIsNone(archivo.plan_item_id)
        with self.assertRaises(HTTPException) as error:
            main.enviar_evidencia(accion.id, self.db, self.usuario)
        self.assertEqual(error.exception.status_code, 400)
        main.asignar_evidencia(archivo.id, EvidenciaAsignar(
            plan_item_id=accion.plan_items[0].id), self.db, self.usuario)
        accion = main.enviar_evidencia(accion.id, self.db, self.usuario)
        self.assertEqual(accion.estado, "Pendiente Verificación")

    def test_plan_futuro_permanece_en_ejecucion(self):
        accion = self.accion()
        accion = main.completar_plan_accion(
            accion.id, self.plan(date.today() + timedelta(days=7)), self.db, self.usuario)
        self.assertEqual(accion.estado, "En ejecución")

    def test_plan_con_plazo_hoy_solicita_evidencias(self):
        accion = self.accion()
        accion = main.completar_plan_accion(
            accion.id, self.plan(date.today()), self.db, self.usuario)
        self.assertEqual(accion.estado, "Pendiente de evidencia")

    def test_configuracion_rechaza_claves_ausentes_cortas_o_anteriores(self):
        script = "from unittest.mock import patch\nwith patch('dotenv.load_dotenv'):\n import auth\n"
        for clave in ("", "corta", "CAMBIAR_ESTA_CLAVE_POR_UNA_SEGURA"):
            with self.subTest(clave=clave):
                entorno = dict(os.environ, JWT_SECRET_KEY=clave)
                resultado = subprocess.run(
                    [sys.executable, "-c", script], cwd=Path(main.__file__).parent,
                    env=entorno, capture_output=True, text=True,
                )
                self.assertNotEqual(resultado.returncode, 0)
                self.assertIn("Configura JWT_SECRET_KEY", resultado.stderr)

    def completar_con_archivos(self):
        accion = self.accion()
        plan = self.plan(date.today())
        plan.acciones[0].evidencia = 'Informe de capacitación.pdf\nLista de asistencia.pdf'
        accion = main.completar_plan_accion(accion.id, plan, self.db, self.usuario)
        for nombre in ('INFORME_DE_CAPACITACION.docx', 'lista_de_asistencia.PDF'):
            self.db.add(EvidenciaArchivo(accion_id=accion.id, plan_item_id=accion.plan_items[0].id,
                nombre_original=nombre, nombre_guardado='virtual.pdf', fecha=main._ahora()))
        self.db.commit()
        self.db.expire_all()
        return accion

    def test_nombres_exactos_sin_coincidencias_parciales(self):
        self.assertEqual(normalizar_nombre('INFORME_DE_CAPACITACION.docx'),
                         normalizar_nombre('Informe de capacitación.pdf'))
        for nombres in ('Informe.pdf\ninforme.docx', '../informe.pdf', '  '):
            with self.subTest(nombres=nombres), self.assertRaises(ValueError):
                validar_nombres(nombres)
        accion = main.completar_plan_accion(self.accion().id, self.plan(date.today()), self.db, self.usuario)
        with self.assertRaises(ValueError):
            comprobar_archivo(accion, accion.plan_items[0].id, 'informe final.pdf')

    def test_cada_nombre_es_obligatorio_y_no_se_aceptan_duplicados(self):
        accion = self.completar_con_archivos()
        self.assertEqual(main._checklist_evidencias(accion), ([], []))
        archivo = accion.evidencias[0]
        with self.assertRaises(ValueError):
            comprobar_archivo(accion, archivo.plan_item_id, archivo.nombre_original)
        self.db.delete(archivo)
        self.db.commit()
        self.db.expire_all()
        with self.assertRaises(HTTPException) as error:
            main.enviar_evidencia(accion.id, self.db, self.usuario)
        self.assertEqual(error.exception.status_code, 400)
        self.assertIn('Informe de capacitación', error.exception.detail)

    def test_subida_y_reasignacion_rechazan_nombre_incorrecto(self):
        accion = main.completar_plan_accion(self.accion().id, self.plan(date.today()), self.db, self.usuario)
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.subir_evidencia(accion.id, UploadFile(filename='otro.pdf', file=BytesIO(b'pdf')),
                                           accion.plan_items[0].id, self.db, self.usuario))
        self.assertEqual(error.exception.status_code, 400)
        archivo = EvidenciaArchivo(accion_id=accion.id, nombre_original='otro.pdf',
                                  nombre_guardado='virtual.pdf', fecha=main._ahora())
        self.db.add(archivo); self.db.commit(); self.db.expire_all()
        with self.assertRaises(HTTPException):
            main.asignar_evidencia(archivo.id, EvidenciaAsignar(plan_item_id=accion.plan_items[0].id),
                                  self.db, self.usuario)

    def test_no_cierra_con_verificacion_vacia(self):
        accion = self.completar_con_archivos()
        main.enviar_evidencia(accion.id, self.db, self.usuario)
        with self.assertRaises(HTTPException):
            main.completar_verificacion(accion.id, VerificacionUpdate(), self.db, self.admin)
        self.assertEqual(accion.estado, 'Pendiente Verificación')

    def test_word_solo_cerradas_y_respeta_acceso_por_area(self):
        accion = self.completar_con_archivos()
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.descargar_formulario_word(accion.id, None, self.db, self.usuario))
        self.assertEqual(error.exception.status_code, 400)
        main.enviar_evidencia(accion.id, self.db, self.usuario)
        accion = main.completar_verificacion(accion.id, VerificacionUpdate(
            descripcion_verificacion='Documentos revisados', conclusion='Acción eficaz'), self.db, self.admin)
        respuesta = asyncio.run(main.descargar_formulario_word(accion.id, None, self.db, self.usuario))
        self.assertIn('filename*=', respuesta.headers['content-disposition'])
        otro = Usuario(nombre_completo='Otra área', correo='otro@test.local', password_hash='sin login', rol='usuario')
        self.db.add(otro); self.db.commit()
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.descargar_formulario_word(accion.id, None, self.db, otro))
        self.assertEqual(error.exception.status_code, 403)
        with self.assertRaises(HTTPException):
            main.eliminar_evidencia(accion.evidencias[0].id, self.db, self.admin)

    def test_word_preserva_plantilla_y_completa_campos_y_firma_opcional(self):
        accion = self.completar_con_archivos()
        accion.procesos = 'Gestión de calidad'
        accion.descripcion_verificacion = 'Se revisó <informe> & lista'
        accion.conclusion = 'Eficaz'
        accion.coordinador_sistemas_gestion = 'Coordinadora de prueba'
        accion.fecha_verificacion = date.today().isoformat()
        accion.estado = 'Cerrada'
        original = PLANTILLA.read_bytes()
        with ZipFile(BytesIO(original)) as referencia, ZipFile(generar_formulario(accion)) as generado:
            self.assertEqual(set(referencia.namelist()), set(generado.namelist()))
            for nombre in referencia.namelist():
                if nombre != 'word/document.xml':
                    self.assertEqual(referencia.read(nombre), generado.read(nombre), nombre)
            doc = minidom.parseString(generado.read('word/document.xml'))
            texto = ''.join(n.firstChild.data for n in doc.getElementsByTagNameNS(W, 't') if n.firstChild)
            self.assertIn('Se revisó <informe> & lista', texto)
            self.assertIn('INFORME_DE_CAPACITACION.docx', texto)
            self.assertIn('Gestión de calidad', texto)
            self.assertNotIn('X Completa', texto)
            origen = minidom.parseString(referencia.read('word/document.xml'))
            self.assertEqual(doc.getElementsByTagNameNS(W, 'sectPr')[0].toxml(),
                             origen.getElementsByTagNameNS(W, 'sectPr')[0].toxml())
        imagen = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh0kAAAAASUVORK5CYII=')
        with ZipFile(generar_formulario(accion, imagen)) as generado:
            self.assertEqual(generado.read('word/media/firma_sello.png'), imagen)
            self.assertIn(b'rIdFirmaSello', generado.read('word/document.xml'))
            for nombre in generado.namelist():
                if nombre.endswith('.xml') or nombre.endswith('.rels'):
                    minidom.parseString(generado.read(nombre))
        self.assertEqual(PLANTILLA.read_bytes(), original)
        with self.assertRaises(ValueError):
            generar_formulario(accion, b'no es una imagen')
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.descargar_formulario_word(accion.id, UploadFile(filename='firma.png', file=BytesIO(imagen)),
                                                      self.db, self.usuario))
        self.assertEqual(error.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
