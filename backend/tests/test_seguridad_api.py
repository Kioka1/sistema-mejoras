"""Pruebas HTTP aisladas de las barreras de la API."""
import asyncio
import json
from http.cookies import SimpleCookie
from io import BytesIO
import os
from pathlib import Path
import secrets
import sys
from time import time
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("JWT_SECRET_KEY", secrets.token_urlsafe(48))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from openpyxl import load_workbook

import main
import seguridad_http
from auth import DURACION_SESION, INACTIVIDAD_SESION, hashear_password
from config_seguridad import COOKIE_GOOGLE, COOKIE_SESION
from database import Base, SesionUsuario, Usuario, get_db


ORIGEN = "https://mejoras.example.org"
PASSWORD = "una clave de prueba"


class SeguridadAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = hashear_password(PASSWORD)

    def setUp(self):
        engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)

        def sesion():
            with Session(engine) as db:
                yield db

        self.engine = engine
        self.cookies = {}
        with Session(engine) as db:
            db.add_all([
                Usuario(id=1, correo="area@unifranz.edu.bo", nombre_completo="Área", rol="usuario",
                        password_hash=self.password_hash, activo=True),
                Usuario(id=2, correo="admin@unifranz.edu.bo", nombre_completo="Admin", rol="admin",
                        password_hash=self.password_hash, activo=True),
            ])
            db.commit()
        main.app.dependency_overrides[get_db] = sesion
        self.addCleanup(main.app.dependency_overrides.clear)
        parche = patch.multiple(seguridad_http, ORIGENES_WEB={ORIGEN}, _contadores={}, _ultima_limpieza=0)
        parche.start()
        self.addCleanup(parche.stop)
        for middleware in main.app.user_middleware:
            if middleware.cls is main.CORSMiddleware:
                opciones = patch.dict(middleware.kwargs, {"allow_origins": [ORIGEN]})
                opciones.start()
                self.addCleanup(opciones.stop)
        main.app.middleware_stack = None
        self.addCleanup(setattr, main.app, "middleware_stack", None)

    def solicitud(self, metodo, ruta, datos=None, *, origen=ORIGEN, ip="192.0.2.1", cookies=None,
                  headers=None, chunks=None):
        url = urlsplit(ruta)
        peticion = dict(headers or {})
        if origen is not None:
            peticion["origin"] = origen
        if datos is not None:
            peticion["content-type"] = "application/json"
            chunks = [json.dumps(datos).encode()]
        if cookies is None:
            cookies = self.cookies
        if cookies:
            peticion["cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
        mensajes = iter(chunks or [b""])
        siguiente = next(mensajes, None)
        respuesta = []

        async def recibir():
            nonlocal siguiente
            if siguiente is None:
                return {"type": "http.disconnect"}
            parte = siguiente
            siguiente = next(mensajes, None)
            return {"type": "http.request", "body": parte, "more_body": siguiente is not None}

        async def enviar(mensaje):
            respuesta.append(mensaje)

        scope = {
            "type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"}, "http_version": "1.1",
            "method": metodo, "scheme": "https", "path": url.path, "root_path": "",
            "query_string": url.query.encode(), "client": (ip, 12345), "server": ("mejoras.example.org", 443),
            "headers": [(k.lower().encode(), v.encode()) for k, v in peticion.items()],
        }
        asyncio.run(main.app(scope, recibir, enviar))
        cabeceras = {}
        for clave, valor in respuesta[0]["headers"]:
            nombre, valor = clave.decode(), valor.decode()
            cabeceras[nombre] = valor
            if nombre == "set-cookie":
                leidas = SimpleCookie(valor)
                for cookie in leidas.values():
                    if cookie["max-age"] == "0":
                        self.cookies.pop(cookie.key, None)
                    else:
                        self.cookies[cookie.key] = cookie.value
        cuerpo = b"".join(m.get("body", b"") for m in respuesta[1:])
        return respuesta[0]["status"], cabeceras, cuerpo

    def login(self, correo="area@unifranz.edu.bo"):
        return self.solicitud("POST", "/api/auth/login", {"correo": correo, "password": PASSWORD})

    def test_todas_las_rutas_privadas_rechazan_anonimos(self):
        publicas = {"/api/auth/login", "/api/auth/google", "/api/auth/google/desafio"}
        rutas = [r for r in main.app.routes if getattr(r, "path", None)] + main.formularios_router.routes
        self.assertGreater(len(rutas), 40)
        for ruta in rutas:
            if ruta.path in publicas:
                continue
            for metodo in ruta.methods:
                with self.subTest(metodo=metodo, ruta=ruta.path):
                    concreta = ruta.path_format
                    for campo in ruta.param_convertors:
                        concreta = concreta.replace("{" + campo + "}", "1")
                    self.assertEqual(self.solicitud(metodo, concreta)[0], 401)

    def test_cookie_protegida_y_logout_invalida_copia(self):
        estado, headers, cuerpo = self.login("AREA@unifranz.edu.bo")
        self.assertEqual(estado, 200)
        self.assertNotIn("access_token", json.loads(cuerpo))
        for atributo in ("HttpOnly", "SameSite=strict", "Path=/"):
            self.assertIn(atributo, headers["set-cookie"])
        if COOKIE_SESION.startswith("__Host-"):
            self.assertIn("Secure", headers["set-cookie"])
        self.assertEqual(headers["cache-control"], "no-store")
        copia = self.cookies.copy()
        self.assertEqual(self.solicitud("GET", "/api/auth/me")[0], 200)
        self.assertEqual(self.solicitud("POST", "/api/auth/logout")[0], 204)
        self.assertEqual(self.solicitud("GET", "/api/auth/me", cookies=copia)[0], 401)

    def test_token_en_query_o_bearer_es_rechazado(self):
        self.login()
        token = self.cookies[COOKIE_SESION]
        self.assertEqual(self.solicitud("GET", f"/api/evidencias/1/descargar?token={token}", cookies={})[0], 401)
        self.assertEqual(self.solicitud("GET", "/api/auth/me", cookies={},
                                        headers={"authorization": f"Bearer {token}"})[0], 401)

    def test_get_de_fondo_no_extiende_sesion_y_post_si(self):
        self.login()
        with Session(self.engine) as db:
            sesion = db.query(SesionUsuario).one()
            sesion.ultima_actividad = int(time()) - 60
            anterior = sesion.ultima_actividad
            db.commit()
        self.assertEqual(self.solicitud("GET", "/api/auth/me")[0], 200)
        with Session(self.engine) as db:
            self.assertEqual(db.query(SesionUsuario).one().ultima_actividad, anterior)
        self.assertEqual(self.solicitud("POST", "/api/auth/actividad")[0], 204)
        with Session(self.engine) as db:
            self.assertGreater(db.query(SesionUsuario).one().ultima_actividad, anterior)

    def test_vencimientos(self):
        for cambio in ({"ultima_actividad": int(time()) - INACTIVIDAD_SESION},
                       {"expira": int(time()) - 1}):
            with self.subTest(cambio=cambio):
                self.assertEqual(self.login()[0], 200)
                with Session(self.engine) as db:
                    sesion = db.query(SesionUsuario).one()
                    self.assertLessEqual(sesion.expira - int(time()), DURACION_SESION)
                    for campo, valor in cambio.items():
                        setattr(sesion, campo, valor)
                    db.commit()
                self.assertEqual(self.solicitud("GET", "/api/auth/me")[0], 401)

    def test_rol_y_revocacion_al_cambiar_password(self):
        self.login()
        copia = self.cookies.copy()
        for ruta in ("/api/usuarios", "/api/registros", "/api/dashboard", "/api/acciones-mejora/exportar"):
            self.assertEqual(self.solicitud("GET", ruta)[0], 403)
        self.cookies.clear()
        self.login("admin@unifranz.edu.bo")
        self.assertEqual(self.solicitud("PATCH", "/api/usuarios/1", {"password": "clave diferente para probar"})[0], 200)
        self.assertEqual(self.solicitud("GET", "/api/auth/me", cookies=copia)[0], 401)

    def test_cors_y_escrituras_solo_desde_origen_permitido(self):
        preflight = {"access-control-request-method": "POST", "access-control-request-headers": "content-type"}
        permitido = self.solicitud("OPTIONS", "/api/auth/login", headers=preflight)
        self.assertEqual(permitido[0], 200)
        self.assertEqual(permitido[1]["access-control-allow-origin"], ORIGEN)
        self.assertEqual(permitido[1]["access-control-allow-credentials"], "true")
        for host in ("https://otro.devtunnels.ms", "null", None):
            self.assertEqual(self.solicitud("POST", "/api/auth/login", {}, origen=host)[0], 403)
        rechazado = self.solicitud("OPTIONS", "/api/auth/login", origen="https://otro.devtunnels.ms", headers=preflight)
        self.assertEqual(rechazado[0], 400)
        self.assertNotIn("access-control-allow-origin", rechazado[1])

    def test_validacion_no_refleja_secretos_ni_campos_inesperados(self):
        clave = "secreto-que-no-debe-salir-" * 6
        estado, _, cuerpo = self.solicitud("POST", "/api/auth/login", {"correo": "invalido", "password": clave})
        self.assertEqual(estado, 422)
        self.assertNotIn(clave.encode(), cuerpo)
        self.login("admin@unifranz.edu.bo")
        for datos in ({"rol": "superadmin"}, {"plazo_dias": 366}, {"estado": "estado inventado"}):
            self.assertEqual(self.solicitud("POST", "/api/acciones-mejora", {"declaracion_hallazgo": "x", **datos})[0], 422)
        self.assertEqual(self.solicitud("GET", "/api/acciones-mejora/999999999999999999")[0], 422)
        self.assertEqual(self.solicitud("GET", "/api/acciones-mejora/exportar?filtro=invalido")[0], 400)

    def test_limite_de_cuerpo_tambien_sin_content_length(self):
        maximo = seguridad_http.MAX_CUERPO
        self.assertEqual(self.solicitud("POST", "/api/auth/login", headers={"content-length": str(maximo + 1)})[0], 413)
        self.assertEqual(self.solicitud("POST", "/api/auth/login", headers={"content-type": "application/json"},
                                       chunks=[b" " * maximo, b"x"])[0], 413)

    def test_error_interno_no_divulga_la_excepcion(self):
        with patch.object(main, "verificar_password", side_effect=RuntimeError("secreto-interno")):
            with self.assertLogs("sistema_mejoras", level="ERROR") as logs:
                estado, _, cuerpo = self.login()
        self.assertEqual(estado, 500)
        self.assertNotIn(b"secreto-interno", cuerpo)
        self.assertNotIn("secreto-interno", "\n".join(logs.output))
        self.assertIn(json.loads(cuerpo)["referencia"], logs.output[0])

    def test_exportar_excel_conserva_entrada_como_texto(self):
        self.login("admin@unifranz.edu.bo")
        formula = "=1+1"
        self.assertEqual(self.solicitud("POST", "/api/acciones-mejora", {"declaracion_hallazgo": formula})[0], 200)
        estado, _, cuerpo = self.solicitud("GET", "/api/acciones-mejora/exportar?columnas=declaracion_hallazgo")
        self.assertEqual(estado, 200)
        celda = load_workbook(BytesIO(cuerpo)).active["A2"]
        self.assertEqual(celda.value, formula)
        self.assertEqual(celda.data_type, "s")

    def test_rate_limit_por_cuenta_por_ip_y_por_usuario(self):
        with patch.object(main, "verificar_password", return_value=False):
            datos = {"correo": "area@unifranz.edu.bo", "password": PASSWORD}
            for n in range(10):
                self.assertEqual(self.solicitud("POST", "/api/auth/login", datos, ip=f"192.0.2.{n + 10}")[0], 401)
            estado, headers, _ = self.solicitud("POST", "/api/auth/login", datos, ip="192.0.2.99")
            self.assertEqual(estado, 429)
            self.assertGreater(int(headers["retry-after"]), 0)

        self.login("admin@unifranz.edu.bo")
        for _ in range(180):
            seguridad_http.limitar("usuario", 2, 180)
        self.assertEqual(self.solicitud("GET", "/api/auth/me", ip="192.0.2.90")[0], 429)
        for _ in range(600):
            seguridad_http.limitar("ip", "192.0.2.91", 600)
        self.assertEqual(self.solicitud("GET", "/api/auth/me", ip="192.0.2.91", cookies={},
                                        headers={"x-forwarded-for": "192.0.2.92"})[0], 429)

    def test_google_workspace_vinculacion_y_nonce_de_un_solo_uso(self):
        estado, _, cuerpo = self.solicitud("POST", "/api/auth/google/desafio")
        self.assertEqual(estado, 200)
        copia = {COOKIE_GOOGLE: self.cookies[COOKIE_GOOGLE]}
        payload = {"email": "area@unifranz.edu.bo", "email_verified": True, "sub": "cuenta-google",
                   "nonce": json.loads(cuerpo)["nonce"]}
        datos = {"credential": "cabecera.datos.firma"}
        with patch.object(main.google_id_token, "verify_oauth2_token", return_value=payload):
            self.assertEqual(self.solicitud("POST", "/api/auth/google", datos)[0], 403)
            payload["hd"] = "unifranz.edu.bo"
            payload["email"] = "sin-cuenta@unifranz.edu.bo"
            self.assertEqual(self.solicitud("POST", "/api/auth/google", datos)[0], 401)
            payload["email"] = "area@unifranz.edu.bo"
            self.assertEqual(self.solicitud("POST", "/api/auth/google", datos)[0], 409)
            datos["password_vinculacion"] = PASSWORD
            self.assertEqual(self.solicitud("POST", "/api/auth/google", datos)[0], 200)
            self.assertEqual(self.solicitud("POST", "/api/auth/google", datos, cookies=copia)[0], 401)


if __name__ == "__main__":
    unittest.main()
