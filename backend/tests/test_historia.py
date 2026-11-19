"""Historia visible para el usuario de su área y para el administrador."""
import unittest
import test_regresiones
import main
from database import Usuario
from schemas import AccionMejoraOut
from fastapi import HTTPException


class Historia(unittest.TestCase):
    setUp = test_regresiones.Regresiones.setUp
    accion = test_regresiones.Regresiones.accion

    def test_historia_visible_solo_en_acciones_autorizadas(self):
        accion = self.accion()
        for usuario in (self.usuario, self.admin):
            detalle = main.obtener_accion(accion.id, self.db, usuario)
            salida = AccionMejoraOut.model_validate(detalle)
            self.assertTrue(salida.historial)
            self.assertIn("Registrada", salida.historial[0].evento)
            self.assertIn(accion.id, [a.id for a in main.listar_acciones(self.db, usuario)])
        otro = Usuario(nombre_completo="Otra área", correo="otra@test.local", rol="usuario", password_hash="sin login")
        self.db.add(otro)
        self.db.commit()
        self.assertEqual(main.listar_acciones(self.db, otro), [])
        with self.assertRaises(HTTPException) as error:
            main.obtener_accion(accion.id, self.db, otro)
        self.assertEqual(error.exception.status_code, 403)
