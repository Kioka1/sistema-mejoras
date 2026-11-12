"""Casos históricos en memoria y archivos temporales; no toca la base real."""
import asyncio
from hashlib import sha256
from io import BytesIO
import os
from pathlib import Path
import secrets
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from zipfile import ZipFile, ZIP_DEFLATED

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['JWT_SECRET_KEY'] = secrets.token_urlsafe(48)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main
import importar_formularios as servicio
from database import Base, engine, SessionLocal, Area, Usuario, AccionMejora, FormularioHistorico, asignar_areas
from fastapi import HTTPException, UploadFile
from formulario_word import generar_formulario, PLANTILLA
from leer_formulario import leer_formulario


def documento(codigo='AM BS-EA-03-24'):
    caso = SimpleNamespace(
        numero=codigo, numero_ac_original=codigo,
        declaracion_hallazgo='Hallazgo antiguo: falta de registros.',
        fuente_identificacion='BS', procesos='Gestión académica',
        informe_investigacion='Investigación del caso', analisis_causa_raiz='Causa documentada',
        correccion_inmediata='Se corrigió el registro', plan_accion='Capacitar al equipo',
        evidencia_parte1='Informe firmado.pdf', responsables='Responsable original',
        fecha_llenado_parte1='2024-02-05', plazo_ejecucion='2024-03-01',
        fecha_verificacion='2024-03-04', descripcion_verificacion='Se revisaron los registros',
        evidencia_parte2='Informe contrastado', conclusion='La acción fue eficaz',
        coordinador_sistemas_gestion='Coordinadora original', numero_accion_derivada=None,
        plan_items=[], evidencias=[],
    )
    return generar_formulario(caso).getvalue()


class ImportacionFormularios(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.db = SessionLocal()
        self.addCleanup(self.db.close)
        self.temporal = TemporaryDirectory(prefix='prueba-importacion-', dir=Path(__file__).resolve().parents[1] / 'uploads')
        self.addCleanup(self.temporal.cleanup)
        cambio = patch.object(servicio, 'DIRECTORIO', Path(self.temporal.name))
        cambio.start(); self.addCleanup(cambio.stop)
        correo = patch.object(main, 'enviar_correo')
        self.correo = correo.start(); self.addCleanup(correo.stop)
        self.admin = Usuario(nombre_completo='Admin', correo='admin@prueba.local', password_hash='sin login', rol='admin')
        self.usuario = Usuario(nombre_completo='Responsable', correo='area@prueba.local', password_hash='sin login', rol='usuario')
        self.db.add_all([self.admin, self.usuario, Area(nombre='TI')]); self.db.flush()
        asignar_areas(self.db, self.usuario, ['TI']); self.db.commit()
        self.contenido = documento()

    def datos(self, estado='Cerrada', **cambios):
        campos = leer_formulario(self.contenido)['datos']
        campos.update(hash_archivo=sha256(self.contenido).hexdigest(), estado=estado, areas=['TI'])
        campos.update(cambios)
        return servicio.DatosHistoricos(**campos)

    def importar(self, **cambios):
        return servicio.guardar_historico(self.db, self.admin, self.datos(**cambios), self.contenido, 'original.docx')

    def test_lee_los_campos_y_fechas_del_formato_lleno(self):
        lectura = leer_formulario(self.contenido)
        self.assertEqual(lectura['estado_sugerido'], 'Cerrada')
        datos = lectura['datos']
        for campo, valor in {'numero_ac_original': 'AM BS-EA-03-24', 'sede': 'El Alto',
                             'fecha_llenado_parte1': '2024-02-05', 'plazo_ejecucion': '2024-03-01',
                             'conclusion': 'La acción fue eficaz', 'plan_accion': 'Capacitar al equipo',
                             'analisis_causa_raiz': 'Causa documentada'}.items():
            self.assertEqual(datos[campo], valor, campo)

    def test_plantilla_vacia_no_inventa_datos_y_rechaza_documentos_ajenos(self):
        lectura = leer_formulario(PLANTILLA.read_bytes())
        self.assertEqual(lectura['datos']['numero_ac_original'], '')
        self.assertFalse(lectura['datos'].get('declaracion_hallazgo'))
        with self.assertRaises(ValueError):
            leer_formulario(b'no es Word')
        salida = BytesIO()
        with ZipFile(salida, 'w', ZIP_DEFLATED) as z:
            z.writestr('word/document.xml', '<!DOCTYPE w [<!ENTITY e "x">]><w/>')
        with self.assertRaises(ValueError):
            leer_formulario(salida.getvalue())

    def test_previsualizar_no_guarda_registros_ni_archivos(self):
        lectura = asyncio.run(servicio.previsualizar_formulario(
            UploadFile(filename='lleno.docx', file=BytesIO(self.contenido)), self.db, self.admin))
        self.assertIsNone(lectura['duplicado'])
        self.assertEqual(self.db.query(AccionMejora).count(), 0)
        self.assertEqual(list(Path(self.temporal.name).iterdir()), [])

    def test_conserva_original_y_fechas_sin_generar_evidencias_o_avisos(self):
        accion = self.importar()
        self.assertEqual(accion.estado, 'Cerrada')
        self.assertEqual(accion.fecha_creacion, '')
        self.assertEqual(accion.fecha_llenado_parte1, '2024-02-05')
        origen = accion.formulario_historico
        self.assertEqual((servicio.DIRECTORIO / origen.nombre_guardado).read_bytes(), self.contenido)
        self.assertEqual(accion.evidencias, [])
        self.assertFalse(origen.seguimiento_activo)
        self.correo.assert_not_called()

    def test_no_duplica_por_archivo_ni_por_codigo(self):
        self.importar()
        with self.assertRaises(HTTPException) as error:
            self.importar(numero_ac_original='OTRO-01')
        self.assertEqual(error.exception.status_code, 409)
        otro = documento('AM BS-EA-99-24')
        with self.assertRaises(HTTPException) as error:
            servicio.guardar_historico(self.db, self.admin, self.datos(hash_archivo=sha256(otro).hexdigest()), otro, 'otro.docx')
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(self.db.query(AccionMejora).count(), 1)
        self.assertEqual(len(list(Path(self.temporal.name).iterdir())), 1)

    def test_historico_pendiente_no_cambia_estado_hasta_activar_seguimiento(self):
        accion = self.importar(estado='En ejecución')
        main._revisar_vencidas_y_notificar(self.db)
        self.assertEqual(accion.estado, 'En ejecución')
        self.correo.assert_not_called()
        servicio.cambiar_seguimiento(accion.formulario_historico.id,
                                    servicio.SeguimientoHistorico(activo=True), self.db, self.admin)
        main._revisar_vencidas_y_notificar(self.db)
        self.assertEqual(accion.estado, 'Pendiente de evidencia')
        self.correo.assert_called()

    def test_original_solo_para_admin_o_area_asignada(self):
        accion = self.importar()
        respuesta = servicio.descargar_original(accion.formulario_historico.id, self.db, self.usuario)
        self.assertTrue(Path(respuesta.path).is_file())
        ajeno = Usuario(nombre_completo='Ajeno', correo='ajeno@prueba.local', password_hash='sin login', rol='usuario')
        self.db.add(ajeno); self.db.commit()
        with self.assertRaises(HTTPException) as error:
            servicio.descargar_original(accion.formulario_historico.id, self.db, ajeno)
        self.assertEqual(error.exception.status_code, 403)

    def test_no_importa_si_cambio_el_archivo_o_no_hay_area_valida(self):
        for cambios in ({'hash_archivo': '0' * 64}, {'areas': ['Inexistente']}, {'numero_ac_original': 'AM BS-EA-XX-XX'}):
            with self.subTest(cambios=cambios), self.assertRaises(HTTPException):
                self.importar(**cambios)
        self.assertEqual(self.db.query(AccionMejora).count(), 0)

    def test_fallo_de_commit_revierte_registro_y_archivo_nuevo(self):
        with patch.object(self.db, 'commit', side_effect=OSError('Fallo simulado')):
            with self.assertRaises(OSError):
                self.importar()
        self.assertEqual(self.db.query(AccionMejora).count(), 0)
        self.assertEqual(self.db.query(FormularioHistorico).count(), 0)
        self.assertEqual(list(Path(self.temporal.name).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
