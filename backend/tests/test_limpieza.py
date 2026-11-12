"""La limpieza se prueba únicamente con SQLite en memoria."""
from contextlib import redirect_stdout
from io import StringIO
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from zipfile import ZipFile

from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from database import Base, Usuario, Area, AccionMejora, HistorialAccion, PlanAccionItem, Recomendacion, Solicitud, HistorialSolicitud, usuario_areas
from limpiar_acciones import limpiar


class Limpieza(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.addCleanup(self.engine.dispose)
        self.temporal = TemporaryDirectory(prefix='prueba-limpieza-', dir=Path(__file__).resolve().parents[1] / 'uploads')
        self.addCleanup(self.temporal.cleanup)
        with Session(self.engine) as db:
            db.add_all([
                Usuario(nombre_completo='Conservar', correo='prueba@test.local', password_hash='prueba', rol='admin'),
                Area(nombre='Área conservada'),
                Recomendacion(area='Área conservada', texto='Conservar recomendación', fecha='2026-10-27'),
            ])
            accion = AccionMejora(numero='AM PRUEBA', declaracion_hallazgo='Prueba aislada', fecha_creacion='2026-10-27')
            db.add(accion)
            db.flush()
            db.add_all([
                HistorialAccion(accion_id=accion.id, fecha='2026-10-27', evento='Prueba'),
                PlanAccionItem(accion_id=accion.id, accion_texto='Plan de prueba'),
            ])
            db.commit()

    def cantidad(self, modelo):
        with self.engine.connect() as conn:
            return conn.execute(select(func.count()).select_from(modelo)).scalar_one()

    def test_previsualizacion_no_modifica_datos(self):
        with redirect_stdout(StringIO()):
            resultado = limpiar(self.engine, respaldos=self.temporal.name)
        self.assertIsNone(resultado)
        self.assertEqual(self.cantidad(AccionMejora), 1)
        self.assertEqual(list(Path(self.temporal.name).iterdir()), [])

    def test_respalda_y_limpia_sin_borrar_usuarios_areas_o_recomendaciones(self):
        with redirect_stdout(StringIO()):
            respaldo = limpiar(self.engine, aplicar=True, respaldos=self.temporal.name)
        with ZipFile(respaldo) as archivo:
            datos = json.loads(archivo.read('respaldo.json'))
            self.assertEqual(len(datos['filas']['acciones_mejora']), 1)
            self.assertEqual(len(datos['filas']['historial_acciones']), 1)
        for modelo in (AccionMejora, HistorialAccion, PlanAccionItem):
            self.assertEqual(self.cantidad(modelo), 0)
        for modelo in (Usuario, Area, Recomendacion):
            self.assertEqual(self.cantidad(modelo), 1)

    def test_no_borra_si_falla_el_respaldo(self):
        with patch('limpiar_acciones.ZipFile', side_effect=OSError('Fallo simulado')):
            with redirect_stdout(StringIO()), self.assertRaises(OSError):
                limpiar(self.engine, aplicar=True, respaldos=self.temporal.name)
        self.assertEqual(self.cantidad(AccionMejora), 1)
        self.assertEqual(self.cantidad(HistorialAccion), 1)

    def test_solo_catalogos_limpia_otros_modulos_aun_sin_acciones(self):
        with Session(self.engine) as db:
            db.query(HistorialAccion).delete()
            db.query(PlanAccionItem).delete()
            db.query(AccionMejora).delete()
            usuario = db.query(Usuario).one()
            area = db.query(Area).one()
            usuario.areas_rel = [area]
            solicitud = Solicitud(numero='SOL-PRUEBA', asunto='Prueba', fecha_envio='2026-10-27')
            db.add(solicitud)
            db.flush()
            db.add(HistorialSolicitud(solicitud_id=solicitud.id, fecha='2026-10-27', evento='Prueba'))
            db.commit()
        with redirect_stdout(StringIO()):
            respaldo = limpiar(self.engine, aplicar=True, respaldos=self.temporal.name, solo_catalogos=True)
        with ZipFile(respaldo) as archivo:
            datos = json.loads(archivo.read('respaldo.json'))
            self.assertEqual(len(datos['filas']['solicitudes']), 1)
            self.assertEqual(len(datos['filas']['recomendaciones']), 1)
        for modelo in (AccionMejora, Recomendacion, Solicitud, HistorialSolicitud):
            self.assertEqual(self.cantidad(modelo), 0)
        for modelo in (Usuario, Area, usuario_areas):
            self.assertEqual(self.cantidad(modelo), 1)


if __name__ == '__main__':
    unittest.main()
