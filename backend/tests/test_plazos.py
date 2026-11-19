"""Fechas hábiles y avisos persistentes, con base en memoria y correo simulado."""
import unittest
from datetime import date
from unittest.mock import patch
import test_regresiones as regresiones
from plazos import sumar_habiles, dias_habiles, alerta_accion
from schemas import AccionMejoraCreate, AccionMejoraEdicion, AccionMejoraOut, LoteAccionesCreate, NotificacionesOut, ObservacionCreate
from database import FormularioHistorico, Usuario, asignar_areas
import main


class Plazos(unittest.TestCase):
    setUp = regresiones.Regresiones.setUp
    accion = regresiones.Regresiones.accion
    plan = regresiones.Regresiones.plan

    def test_asignacion_avisa_a_todos_los_activos_del_area_sin_duplicar(self):
        segundo = Usuario(nombre_completo="TI 2", correo="ti2@test.local", password_hash="sin login", rol="usuario")
        otro = Usuario(nombre_completo="Otra área", correo="otra@test.local", password_hash="sin login", rol="usuario")
        inactivo = Usuario(nombre_completo="TI inactivo", correo="inactivo@test.local", password_hash="sin login", rol="usuario", activo=False)
        self.db.add_all([segundo, otro, inactivo])
        self.db.flush()
        asignar_areas(self.db, segundo, ["TI", "Sistemas"])
        asignar_areas(self.db, otro, ["Otra área"])
        asignar_areas(self.db, inactivo, ["TI"])
        self.db.commit()
        with patch.object(main, "enviar_correo") as correo:
            main.crear_accion(AccionMejoraCreate(declaracion_hallazgo="Prueba", areas=["TI", "Sistemas"]), self.db, self.admin)
        self.assertEqual(sorted(c.args[0] for c in correo.call_args_list), ["area@test.local", "ti2@test.local"])

    def test_recordatorio_un_habil_antes_y_no_tras_entregar(self):
        accion = self.accion()
        accion.plazo_entrega_plan = "2026-11-10"
        self.db.commit()
        with patch.object(main, "enviar_correo") as correo:
            with patch.object(main, "hoy_local", return_value=date(2026, 11, 6)):
                main._revisar_vencidas_y_notificar(self.db)
            correo.assert_not_called()
            with patch.object(main, "hoy_local", return_value=date(2026, 11, 9)):
                main._revisar_vencidas_y_notificar(self.db)
                main._revisar_vencidas_y_notificar(self.db)
            correo.assert_called_once()
            self.assertIn("1 día(s) hábil(es)", correo.call_args.args[1])
            accion.estado = "Pendiente Verificación"
            self.db.commit()
            with patch.object(main, "hoy_local", return_value=date(2026, 11, 10)):
                main._revisar_vencidas_y_notificar(self.db)
            correo.assert_called_once()

    def test_diez_habiles_y_margen_evidencias_cruzan_fin_de_semana(self):
        self.assertEqual(sumar_habiles(date(2026, 11, 6), 10), date(2026, 11, 20))
        self.assertEqual(sumar_habiles(date(2026, 11, 6), 2), date(2026, 11, 10))
        self.assertEqual(dias_habiles(date(2026, 11, 6), date(2026, 11, 10)), 2)

    @patch.object(main, "hoy_local", return_value=date(2026, 11, 6))
    def test_plazo_automatico_personalizado_y_lote(self, _):
        self.assertEqual(self.accion().plazo_entrega_plan, "2026-11-20")
        accion = main.crear_accion(AccionMejoraCreate(
            declaracion_hallazgo="Urgente", areas=["TI"], plazo_dias=1), self.db, self.admin)
        self.assertEqual(accion.plazo_entrega_plan, "2026-11-09")
        self.assertEqual(main._resolver_plazo("2026-11-07"), "2026-11-07")
        lote = main.crear_lote_acciones(LoteAccionesCreate(
            areas=["TI"], hallazgos=["Hallazgo"]), self.db, self.admin)
        self.assertEqual(lote["plazo_entrega_plan"], "2026-11-20")
        for invalido in (0, -1, 366):
            with self.assertRaises(main.HTTPException):
                main._plazo_desde_dias(invalido)

    def test_vencimiento_al_final_del_dia_y_dos_habiles_antes(self):
        accion = self.accion()
        accion.plazo_entrega_plan = "2026-11-10"
        self.assertEqual(alerta_accion(accion, date(2026, 11, 5))["nivel"], "pendiente")
        self.assertEqual(alerta_accion(accion, date(2026, 11, 6))["nivel"], "proximo")
        self.assertEqual(alerta_accion(accion, date(2026, 11, 10))["texto"], "Vence hoy")
        self.assertEqual(alerta_accion(accion, date(2026, 11, 11))["nivel"], "vencido")

    def test_editar_otro_campo_conserva_plazo_anterior_vencido(self):
        accion = self.accion()
        accion.plazo_entrega_plan = "2024-01-01"
        self.db.commit()
        main.editar_accion(accion.id, AccionMejoraEdicion(
            plazo_entrega_plan="2024-01-01", procesos="Actualizado"), self.db, self.admin)
        self.assertEqual(accion.plazo_entrega_plan, "2024-01-01")
        self.assertEqual(accion.procesos, "Actualizado")

    @patch.object(main, "hoy_local", return_value=date(2026, 11, 6))
    def test_avisos_no_se_duplican_y_leer_no_quita_pendiente(self, _):
        accion = self.accion()
        accion.plazo_entrega_plan = "2026-11-10"
        self.db.commit()
        with patch("plazos.hoy_local", return_value=date(2026, 11, 6)):
            respuesta = main.mis_notificaciones(self.db, self.usuario)
            cantidad = respuesta["no_leidas"]
            self.assertEqual(cantidad, main.mis_notificaciones(self.db, self.usuario)["no_leidas"])
            main.marcar_todas_leidas(self.db, self.usuario)
            respuesta = main.mis_notificaciones(self.db, self.usuario)
            self.assertEqual(respuesta["no_leidas"], 0)
            self.assertEqual(respuesta["pendientes"][0]["accion_id"], accion.id)
            NotificacionesOut.model_validate(respuesta)
            AccionMejoraOut.model_validate(accion)

    @patch.object(main, "hoy_local", return_value=date(2026, 11, 9))
    def test_evidencias_vencen_dos_habiles_despues_y_se_apagan_al_enviar(self, _):
        accion = self.accion()
        accion.estado = "En ejecución"
        accion.plazo_ejecucion = "2026-11-06"
        self.db.commit()
        main._revisar_vencidas_y_notificar(self.db)
        self.assertEqual(accion.estado, "Pendiente de evidencia")
        self.assertEqual(accion.plazo_evidencias, "2026-11-10")
        self.assertEqual(alerta_accion(accion, date(2026, 11, 9))["nivel"], "proximo")
        accion.estado = "Pendiente Verificación"
        self.assertIsNone(accion.alerta_plazo)
        accion.estado = "Cerrada"
        self.assertIsNone(accion.alerta_plazo)

    def test_no_filtra_pendientes_de_otras_areas_ni_historicos_inactivos(self):
        accion = self.accion()
        asignar_areas(self.db, accion, ["Otra área"])
        self.db.commit()
        self.assertEqual(main.mis_notificaciones(self.db, self.usuario)["pendientes"], [])
        self.db.add(FormularioHistorico(accion_id=accion.id, nombre_original="original.docx",
                    nombre_guardado="virtual.docx", sha256="a" * 64,
                    fecha_importacion="2026-11-04", importado_por="Admin", seguimiento_activo=False))
        self.db.commit()
        self.db.expire_all()
        self.assertIsNone(accion.alerta_plazo)

    def test_admin_ve_todas_las_areas_y_puede_enviar_correcciones(self):
        propia = self.accion()
        otra = main.crear_accion(AccionMejoraCreate(
            declaracion_hallazgo="Pendiente de otra área", areas=["BYF"]), self.db, self.admin)
        otra.estado = "Pendiente de evidencia"
        otra.plazo_ejecucion = "2024-01-01"
        self.db.commit()

        avisos_admin = main.mis_notificaciones(self.db, self.admin)
        por_id = {n["accion_id"]: n for n in avisos_admin["pendientes"]}
        self.assertEqual(set(por_id), {propia.id, otra.id})
        self.assertEqual(por_id[otra.id]["areas"], ["BYF"])
        self.assertEqual(por_id[otra.id]["tipo"], "Evidencias")
        NotificacionesOut.model_validate(avisos_admin)
        avisos_usuario = main.mis_notificaciones(self.db, self.usuario)
        self.assertEqual([n["accion_id"] for n in avisos_usuario["pendientes"]], [propia.id])
        self.assertEqual({a.id for a in main.listar_acciones(self.db, self.admin)}, {propia.id, otra.id})

        main.observar_accion(otra.id, ObservacionCreate(texto="Corrige el plan presentado"), self.db, self.admin)
        self.assertEqual(otra.estado, "Observada")
        self.assertEqual(otra.ultima_observacion, "Corrige el plan presentado")
        self.assertEqual(otra.alerta_plazo["tipo"], "Formulario")

    def test_verificacion_verde_solo_para_admin_y_desaparece_al_cerrar(self):
        accion = self.accion()
        accion.estado = "Pendiente Verificación"
        self.db.commit()
        respuesta = main.mis_notificaciones(self.db, self.admin)
        aviso = respuesta["pendientes"][0]
        self.assertEqual(aviso["estado"], "Pendiente Verificación")
        self.assertEqual(aviso["nivel"], "revision")
        self.assertEqual(aviso["fecha"], "")
        NotificacionesOut.model_validate(respuesta)
        self.assertEqual(main.mis_notificaciones(self.db, self.usuario)["pendientes"], [])
        accion.estado = "Cerrada"
        self.db.commit()
        self.assertEqual(main.mis_notificaciones(self.db, self.admin)["pendientes"], [])
