"""
Servidor (backend) del Sistema de Registro y Seguimiento de Mejoras
e Incidencias.

Esta es la parte "Servidor" de la arquitectura Cliente-Servidor: recibe
peticiones del frontend (React), consulta la base de datos, y devuelve
la información en formato JSON. El frontend nunca toca la base de datos
directamente, siempre pasa por esta API.

Cómo correrlo:
    cd backend
    ./venv/bin/uvicorn main:app --reload

La documentación interactiva de la API queda disponible automáticamente
en http://localhost:8000/docs
"""

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from typing import Optional, List
import os
import re
import uuid
from datetime import datetime, date
from io import BytesIO
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from database import Base, engine, get_db, Registro, AccionMejora, HistorialAccion, Solicitud, HistorialSolicitud, Usuario, EvidenciaArchivo, Recomendacion
from auth import obtener_usuario_actual, obtener_usuario_para_descarga, requerir_admin, requerir_admin_descarga, verificar_password, crear_token, hashear_password
from notificaciones import enviar_correo
from schemas import (
    RegistroCreate, RegistroOut,
    AccionMejoraCreate, AccionMejoraOut, PlanAccionUpdate, VerificacionUpdate, AccionMejoraEdicion,
    SolicitudCreate, SolicitudOut, SolicitudResponder, SolicitudEdicion,
    LoginRequest, GoogleLoginRequest, LoginResponse, UsuarioOut, UsuarioCreate, UsuarioEdicion,
    RecomendacionOut, LoteAccionesCreate, ObservacionCreate,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sistema de Registro y Seguimiento - API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================================
# Autenticación
# =========================================================================

@app.post("/api/auth/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.correo == data.correo).first()
    if not usuario or not verificar_password(data.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    if not usuario.activo:
        raise HTTPException(status_code=401, detail="Este usuario está desactivado")
    token = crear_token(usuario.correo, usuario.rol, usuario.sede)
    return LoginResponse(access_token=token, usuario=usuario)


# ID de cliente OAuth de Google (Google Cloud Console → Credenciales → ID de cliente OAuth 2.0,
# tipo "Aplicación web"). Ponerlo como variable de entorno GOOGLE_CLIENT_ID en el servidor.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID","349423893149-r827m4h6cof4l312vd0n356l9ob0n73v.apps.googleusercontent.com")
DOMINIO_PERMITIDO = "unifranz.edu.bo"


@app.post("/api/auth/google", response_model=LoginResponse)
def login_google(data: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="El login con Google no está configurado en el servidor (falta GOOGLE_CLIENT_ID).")
    try:
        payload = google_id_token.verify_oauth2_token(
            data.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Token de Google inválido o vencido")

    correo = (payload.get("email") or "").lower().strip()
    if not payload.get("email_verified") or not correo.endswith(f"@{DOMINIO_PERMITIDO}"):
        raise HTTPException(status_code=403, detail=f"Solo se permite el ingreso con correos @{DOMINIO_PERMITIDO}")

    usuario = db.query(Usuario).filter(Usuario.correo == correo).first()
    if not usuario:
        # Primer ingreso: se crea la cuenta sola, como Director/a de Carrera sin área todavía.
        # Sistemas de Gestión le asigna el área desde Usuarios para que empiece a ver sus acciones.
        usuario = Usuario(
            nombre_completo=payload.get("name") or correo.split("@")[0],
            correo=correo,
            password_hash=hashear_password(uuid.uuid4().hex),  # nunca se usa: solo entra por Google
            rol="usuario",
            sede="El Alto",
            area=None,
            activo=True,
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        _notificar_admins(
            db,
            "Nueva cuenta creada por Google — falta asignarle área",
            f"{usuario.nombre_completo} ({usuario.correo}) ingresó por primera vez con su correo institucional. "
            "Asígnale su Área/Carrera en Usuarios para que pueda ver sus Acciones de Mejora.",
        )
    elif not usuario.activo:
        raise HTTPException(status_code=401, detail="Este usuario está desactivado")

    token = crear_token(usuario.correo, usuario.rol, usuario.sede)
    return LoginResponse(access_token=token, usuario=usuario)


@app.get("/api/auth/me", response_model=UsuarioOut)
def me(usuario: Usuario = Depends(obtener_usuario_actual)):
    return usuario


@app.get("/api/usuarios", response_model=List[UsuarioOut])
def listar_usuarios(db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    return db.query(Usuario).order_by(Usuario.nombre_completo).all()


@app.post("/api/usuarios", response_model=UsuarioOut)
def crear_usuario(data: UsuarioCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    correo_normalizado = (data.correo or "").strip().lower()
    if not correo_normalizado.endswith(f"@{DOMINIO_PERMITIDO}"):
        raise HTTPException(status_code=400, detail=f"El correo debe ser institucional (@{DOMINIO_PERMITIDO}).")
    data.correo = correo_normalizado
    existente = db.query(Usuario).filter(Usuario.correo == data.correo).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo.")
    nuevo = Usuario(
        nombre_completo=data.nombre_completo,
        correo=data.correo,
        password_hash=hashear_password(data.password),
        rol=data.rol,
        sede=data.sede if data.rol == "usuario" else None,
        area=(data.area or "").strip() or None if data.rol == "usuario" else None,
        activo=True,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.patch("/api/usuarios/{usuario_id}", response_model=UsuarioOut)
def editar_usuario(usuario_id: int, data: UsuarioEdicion, db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    objetivo = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not objetivo:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    cambios = data.dict(exclude_unset=True)
    password_nueva = cambios.pop("password", None)
    for key, value in cambios.items():
        setattr(objetivo, key, value)
    if password_nueva:
        objetivo.password_hash = hashear_password(password_nueva)

    db.commit()
    db.refresh(objetivo)
    return objetivo


# --- Notificaciones: buscan a quién avisar según sede/rol y mandan el correo ---

def _notificar_usuarios_de_sede(db: Session, sede: Optional[str], asunto: str, mensaje: str):
    """Manda el correo a todos los usuarios (Directores de Carrera) activos de esa sede."""
    if not sede:
        return
    destinatarios = db.query(Usuario).filter(Usuario.sede == sede, Usuario.rol == "usuario", Usuario.activo == True).all()
    for u in destinatarios:
        enviar_correo(u.correo, asunto, mensaje)


def _norm_area(valor: Optional[str]) -> str:
    return (valor or "").strip().lower()


def _notificar_usuarios_de_area(db: Session, area: Optional[str], asunto: str, mensaje: str):
    """Manda el correo a los Directores de Carrera activos cuya área/carrera coincide."""
    if not _norm_area(area):
        return
    candidatos = db.query(Usuario).filter(Usuario.rol == "usuario", Usuario.activo == True).all()
    for u in candidatos:
        if _norm_area(u.area) == _norm_area(area):
            enviar_correo(u.correo, asunto, mensaje)


def _notificar_admins(db: Session, asunto: str, mensaje: str):
    """Manda el correo a todos los administradores (Sistemas de Gestión) activos."""
    admins = db.query(Usuario).filter(Usuario.rol == "admin", Usuario.activo == True).all()
    for a in admins:
        enviar_correo(a.correo, asunto, mensaje)


# =========================================================================
# Registros — módulo general de incidencias / oportunidades de mejora.
# NOTA: esta tabla todavía no tiene campo "sede", así que no se puede
# filtrar por sede todavía (solo exige estar logueado).
# =========================================================================

@app.get("/api/registros", response_model=List[RegistroOut])
def listar_registros(q: Optional[str] = None, db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    query = db.query(Registro)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Registro.titulo.ilike(like),
                Registro.sistema.ilike(like),
                Registro.categoria.ilike(like),
                Registro.tipo.ilike(like),
            )
        )
    return query.order_by(Registro.id.desc()).all()


@app.get("/api/registros/{registro_id}/relacionados", response_model=List[RegistroOut])
def registros_relacionados(registro_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    base = db.query(Registro).filter(Registro.id == registro_id).first()
    if not base:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return (
        db.query(Registro)
        .filter(
            Registro.id != registro_id,
            or_(Registro.sistema == base.sistema, Registro.categoria == base.categoria),
        )
        .all()
    )


@app.post("/api/registros", response_model=RegistroOut)
def crear_registro(registro: RegistroCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    nuevo = Registro(**registro.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@app.get("/api/dashboard")
def resumen_dashboard(db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    registros = db.query(Registro).all()
    por_sistema, por_estado = {}, {}
    for r in registros:
        por_sistema[r.sistema] = por_sistema.get(r.sistema, 0) + 1
        por_estado[r.estado] = por_estado.get(r.estado, 0) + 1
    return {
        "total": len(registros),
        "incidencias": sum(1 for r in registros if r.tipo == "Incidencia"),
        "mejoras": sum(1 for r in registros if r.tipo == "Oportunidad de mejora"),
        "pendientes": sum(1 for r in registros if r.estado != "Resuelto"),
        "por_sistema": [{"sistema": k, "cantidad": v} for k, v in por_sistema.items()],
        "por_estado": [{"estado": k, "cantidad": v} for k, v in por_estado.items()],
    }


# =========================================================================
# Acciones de Mejora — flujo de 3 etapas (formulario CAPA de calidad)
# =========================================================================

def _agregar_historial(db: Session, accion: AccionMejora, evento: str):
    db.add(HistorialAccion(accion_id=accion.id, fecha=_ahora(), evento=evento))


def _ahora() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _verificar_acceso_accion(usuario: Usuario, accion: AccionMejora):
    """El Director/a solo accede a las acciones de SU área/carrera. El admin ve todo."""
    if usuario.rol == "admin":
        return
    if not _norm_area(usuario.area) or _norm_area(accion.area_responsable) != _norm_area(usuario.area):
        raise HTTPException(status_code=403, detail="Esta acción no corresponde a tu área.")


def _verificar_acceso_sede(usuario: Usuario, sede: Optional[str]):
    """Un usuario (Director/a de Carrera) solo puede acceder a lo de su propia sede. El admin ve todo."""
    if usuario.rol != "admin" and (sede or "") != (usuario.sede or ""):
        raise HTTPException(status_code=403, detail="No tenés acceso a un registro de otra sede.")


@app.get("/api/acciones-mejora", response_model=List[AccionMejoraOut])
def listar_acciones(db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    _revisar_vencidas_y_notificar(db)
    query = db.query(AccionMejora).options(joinedload(AccionMejora.historial))
    if usuario.rol != "admin":
        if not _norm_area(usuario.area):
            return []
        query = query.filter(func.lower(func.trim(AccionMejora.area_responsable)) == _norm_area(usuario.area))
    return query.order_by(AccionMejora.id.desc()).all()


FILTROS_EXPORTACION = {
    "todos": "Todos los registros",
    "anual": "Solo un año específico",
    "pendientes_entrega": "Pendientes de entrega del plan de acción",
    "pendientes_verificacion": "Pendientes de verificación",
    "cerrados": "Cerrados",
}

COLUMNAS_DISPONIBLES = {
    "numero": ("Número", lambda r: r.numero),
    "numero_ac_original": ("N° AC Original", lambda r: r.numero_ac_original),
    "sede": ("Sede", lambda r: r.sede),
    "estado": ("Estado", lambda r: r.estado),
    "estado_original": ("Estado Original (Excel)", lambda r: r.estado_original),
    "solicitante": ("Solicitante", lambda r: r.solicitante),
    "area_responsable": ("Área Responsable", lambda r: r.area_responsable),
    "categoria": ("Categoría", lambda r: r.categoria),
    "subcategoria": ("Subcategoría", lambda r: r.subcategoria),
    "declaracion_hallazgo": ("Hallazgo", lambda r: r.declaracion_hallazgo),
    "fuente_identificacion": ("Fuente de Identificación", lambda r: r.fuente_identificacion),
    "procesos": ("Proceso(s)", lambda r: r.procesos),
    "requiere_cambio_sgc": ("¿Requiere cambio SGC?", lambda r: r.requiere_cambio_sgc),
    "fecha_creacion": ("Fecha de Creación", lambda r: r.fecha_creacion),
    "plazo_ejecucion": ("Plazo de Ejecución", lambda r: r.plazo_ejecucion),
    "fecha_cierre_plan": ("Fecha de Cierre (Excel)", lambda r: r.fecha_cierre_plan),
    "fecha_verificacion": ("Fecha de Verificación", lambda r: r.fecha_verificacion),
    "plan_accion": ("Plan de Acción", lambda r: r.plan_accion),
    "conclusion": ("Conclusión", lambda r: r.conclusion),
    "observacion": ("Observación", lambda r: r.observacion),
}


@app.get("/api/acciones-mejora/exportar")
def exportar_acciones(
    filtro: str = "todos",
    anio: Optional[str] = None,
    ids: Optional[str] = None,
    columnas: Optional[str] = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(requerir_admin_descarga),
):
    query = db.query(AccionMejora)

    if ids:
        id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
        query = query.filter(AccionMejora.id.in_(id_list))
    elif filtro == "pendientes_entrega":
        query = query.filter(AccionMejora.estado == "Pendiente Plan de Acción")
    elif filtro == "pendientes_verificacion":
        query = query.filter(AccionMejora.estado == "Pendiente Verificación")
    elif filtro == "cerrados":
        query = query.filter(AccionMejora.estado == "Cerrada")
    elif filtro == "anual" and anio:
        query = query.filter(AccionMejora.fecha_creacion.like(f"{anio}%"))

    registros = query.order_by(AccionMejora.id.desc()).all()

    columnas_elegidas = [c for c in (columnas.split(",") if columnas else []) if c in COLUMNAS_DISPONIBLES]
    if not columnas_elegidas:
        columnas_elegidas = list(COLUMNAS_DISPONIBLES.keys())

    wb = Workbook()
    ws = wb.active
    ws.title = "Acciones de Mejora"

    encabezados = [COLUMNAS_DISPONIBLES[c][0] for c in columnas_elegidas]
    ws.append(encabezados)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="1F3864", end_color="1F3864", fill_type="solid")

    for r in registros:
        ws.append([COLUMNAS_DISPONIBLES[c][1](r) for c in columnas_elegidas])

    for col in ws.columns:
        largo = max((len(str(c.value)) for c in col if c.value), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(largo + 2, 45)

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    nombre_archivo = f"acciones_mejora_{'seleccion' if ids else filtro}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )


MAPA_ESTADOS_EXCEL = {
    "Llenado de formulario pendiente": "Pendiente Plan de Acción",
    "Dentro de plazo": "Pendiente Plan de Acción",
    "Debe cerrarse el presente mes": "Pendiente Plan de Acción",
    "Fuera de Plazo": "Pendiente Plan de Acción",
    "Fuera de plazo": "Pendiente Plan de Acción",
    "Pendiente la verificación de la eficacia": "Pendiente Verificación",
    "Cerrada": "Cerrada",
    "Apertura de una nueva acción (Plan de Acción No Implementado)": "Pendiente Plan de Acción",
    "Apertura de una nueva acción (Plan de Accion Implementado No Eficaz)": "Pendiente Plan de Acción",
}

COLUMNAS_ESPERADAS = {"Origen", "N° de AC"}

MAPA_COLUMNAS = {
    "Origen": "origen",
    "N° de AC": "numero_ac",
    "Descripción": "descripcion",
    "Plan de Acción": "plan",
    "Categoría": "categoria",
    "Subcategoría": "subcategoria",
    "Área Responsable": "area",
    "¿Se requiere un cambio en el SGC?": "requiere_cambio",
    "Plazo del Plan de Acción": "plazo",
    "Fecha de Cierre Plan de Acción": "fecha_cierre",
    "Estado": "estado_txt",
    "Observación": "observacion",
}


def _formatear_fecha(valor):
    if valor is None:
        return None
    if hasattr(valor, "isoformat"):
        return valor.isoformat()[:10]
    return str(valor).strip() or None


@app.post("/api/acciones-mejora/importar-excel")
async def importar_excel(archivo: UploadFile = File(...), db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    contenido = await archivo.read()
    try:
        wb = load_workbook(BytesIO(contenido), data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo. ¿Es un .xlsx válido?")

    hojas_procesadas = []
    importados = 0

    for nombre_hoja in wb.sheetnames:
        ws = wb[nombre_hoja]

        fila_encabezado = None
        indices = {}
        for r in range(1, min(6, ws.max_row + 1)):
            valores = {c.value: c.column for c in ws[r] if c.value}
            if COLUMNAS_ESPERADAS.issubset(valores.keys()):
                fila_encabezado = r
                indices = {
                    campo: valores[encabezado]
                    for encabezado, campo in MAPA_COLUMNAS.items()
                    if encabezado in valores
                }
                break
        if fila_encabezado is None:
            continue

        sede = nombre_hoja.replace("Sede", "").strip() or "Nacional"
        filas_de_esta_hoja = 0

        def valor(fila, campo):
            idx = indices.get(campo)
            return fila[idx - 1] if idx and idx <= len(fila) else None

        for fila in ws.iter_rows(min_row=fila_encabezado + 1, max_row=ws.max_row, values_only=True):
            descripcion = valor(fila, "descripcion")
            if not descripcion:
                continue

            estado_txt = valor(fila, "estado_txt")
            total = db.query(AccionMejora).count()
            numero_interno = f"AM-{total + 1:04d}"
            numero_ac = valor(fila, "numero_ac")

            nueva = AccionMejora(
                numero=numero_interno,
                numero_ac_original=str(numero_ac) if numero_ac else None,
                sede=sede,
                estado=MAPA_ESTADOS_EXCEL.get(estado_txt, "Pendiente Plan de Acción"),
                estado_original=estado_txt,
                declaracion_hallazgo=str(descripcion),
                fuente_identificacion=valor(fila, "origen"),
                area_responsable=valor(fila, "area"),
                categoria=valor(fila, "categoria"),
                subcategoria=valor(fila, "subcategoria"),
                plan_accion=valor(fila, "plan"),
                requiere_cambio_sgc=valor(fila, "requiere_cambio"),
                plazo_ejecucion=_formatear_fecha(valor(fila, "plazo")),
                fecha_cierre_plan=_formatear_fecha(valor(fila, "fecha_cierre")),
                observacion=valor(fila, "observacion"),
                fecha_creacion=_ahora(),
            )
            db.add(nueva)
            db.commit()
            db.refresh(nueva)
            _agregar_historial(
                db, nueva,
                f"Importado desde Excel (hoja: {nombre_hoja}, estado original: {estado_txt or 'sin estado'})",
            )
            db.commit()
            importados += 1
            filas_de_esta_hoja += 1

        if filas_de_esta_hoja > 0:
            hojas_procesadas.append(f"{nombre_hoja} ({filas_de_esta_hoja} registros)")

    if not hojas_procesadas:
        raise HTTPException(
            status_code=400,
            detail="No se encontró ninguna hoja con el formato esperado (columnas 'Origen' y 'N° de AC').",
        )

    return {"importados": importados, "hojas_procesadas": hojas_procesadas}


@app.get("/api/acciones-mejora/{accion_id}", response_model=AccionMejoraOut)
def obtener_accion(accion_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    accion = (
        db.query(AccionMejora)
        .options(joinedload(AccionMejora.historial))
        .filter(AccionMejora.id == accion_id)
        .first()
    )
    if not accion:
        raise HTTPException(status_code=404, detail="Acción de Mejora no encontrada")
    _verificar_acceso_accion(usuario, accion)
    return accion


@app.patch("/api/acciones-mejora/{accion_id}", response_model=AccionMejoraOut)
def editar_accion(accion_id: int, data: AccionMejoraEdicion, db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    accion = db.query(AccionMejora).filter(AccionMejora.id == accion_id).first()
    if not accion:
        raise HTTPException(status_code=404, detail="Acción de Mejora no encontrada")

    cambios = data.dict(exclude_unset=True)
    for key, value in cambios.items():
        setattr(accion, key, value)

    if cambios:
        db.commit()
        _agregar_historial(db, accion, f"Editado manualmente ({', '.join(cambios.keys())})")
        db.commit()
    db.refresh(accion)
    return accion


SEDE_CODIGOS = {
    "El Alto": "EA",
    "Cochabamba": "CB",
    "Santa Cruz": "SC",
    "La Paz": "LP",
    "Nacional": "NA",
}


def _generar_numero_ac(db: Session, origen: Optional[str], sede: Optional[str] = None) -> str:
    """
    Código correlativo de la Acción de Mejora: AM {FUENTE}-{N}-{AA}, ej. AM BS-14-26.
    BS = Buzón de Sugerencias. N es el número MÁS ALTO existente + 1 (no una cuenta), y
    considera tanto los códigos del sistema como los originales importados de Excel.
    Acepta también el formato viejo con sede (AM BS-EA-12-26) al buscar el último.
    """
    origen_code = (origen or "BS").strip().upper() or "BS"
    anio = datetime.now().strftime("%y")
    patron = re.compile(rf"^AM\s*{re.escape(origen_code)}-(?:[A-Z]{{2}}-)?(\d+)-{anio}$", re.IGNORECASE)
    maximo = 0
    for numero, original in db.query(AccionMejora.numero, AccionMejora.numero_ac_original).all():
        for valor in (numero, original):
            if valor:
                m = patron.match(valor.strip())
                if m:
                    maximo = max(maximo, int(m.group(1)))
    return f"AM {origen_code}-{maximo + 1:02d}-{anio}"


@app.post("/api/acciones-mejora", response_model=AccionMejoraOut)
def crear_accion(data: AccionMejoraCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    """Registro de una Acción de Mejora. Solo admin. Si se completan directamente
    el Plan de Acción o el Estado (como al transcribir un caso ya resuelto del
    Excel), se respetan tal cual; si no, arranca en la etapa inicial normal."""
    numero = _generar_numero_ac(db, data.fuente_identificacion, data.sede)
    datos = data.dict()
    estado_inicial = datos.pop("estado", None) or "Pendiente Plan de Acción"
    accion = AccionMejora(
        numero=numero,
        estado=estado_inicial,
        fecha_creacion=_ahora(),
        **datos,
    )
    db.add(accion)
    db.commit()
    db.refresh(accion)
    _agregar_historial(db, accion, "Registrada")
    db.commit()
    if estado_inicial == "Pendiente Plan de Acción":
        _notificar_usuarios_de_area(
            db, accion.area_responsable,
            f"Nueva Acción de Mejora asignada — {numero}",
            f"Se registró la Acción de Mejora {numero} y está pendiente de tu plan de acción.\n\nHallazgo: {accion.declaracion_hallazgo}",
        )
    db.refresh(accion)
    return accion


@app.post("/api/acciones-mejora/lote")
def crear_lote_acciones(data: LoteAccionesCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    """
    Una solicitud del buzón de sugerencias para UN área: crea una Acción de Mejora por cada
    hallazgo (cada una con su código AM BS-NN-AA correlativo) y guarda las recomendaciones.
    Al área/carrera le llega UN SOLO correo con todo.
    """
    area = (data.area or "").strip()
    if not area:
        raise HTTPException(status_code=400, detail="Indica el área o carrera destinataria.")
    hallazgos = [h.strip() for h in data.hallazgos if h and h.strip()]
    recomendaciones = [r.strip() for r in data.recomendaciones if r and r.strip()]
    if not hallazgos and not recomendaciones:
        raise HTTPException(status_code=400, detail="Agrega al menos una acción de mejora o una recomendación.")

    hay_destinatario = any(
        _norm_area(u.area) == _norm_area(area)
        for u in db.query(Usuario).filter(Usuario.rol == "usuario", Usuario.activo == True).all()
    )
    if not hay_destinatario:
        raise HTTPException(
            status_code=400,
            detail=f"No hay ningún usuario activo asignado al área '{area}'. Créalo primero en Usuarios.",
        )

    creadas = []
    for texto in hallazgos:
        accion = AccionMejora(
            numero=_generar_numero_ac(db, "BS"),
            estado="Pendiente Plan de Acción",
            fecha_creacion=_ahora(),
            declaracion_hallazgo=texto,
            fuente_identificacion="BS",
            area_responsable=area,
            solicitante=(data.solicitante or "").strip() or None,
            plazo_entrega_plan=data.plazo_entrega_plan or None,
            sede="El Alto",
        )
        db.add(accion)
        db.flush()  # para que el siguiente código correlativo ya cuente este
        _agregar_historial(db, accion, "Registrada y enviada al área")
        creadas.append(accion)
    for texto in recomendaciones:
        db.add(Recomendacion(area=area, texto=texto, fecha=_ahora(), enviada_por=usuario.nombre_completo))
    db.commit()

    partes = [f"Sistemas de Gestión te envió una solicitud del Buzón de Sugerencias para el área {area}."]
    if creadas:
        partes.append("\nAcciones de Mejora (pendientes de tu plan de acción):")
        for a in creadas:
            partes.append(f"  • {a.numero}: {a.declaracion_hallazgo}")
        if data.plazo_entrega_plan:
            partes.append(f"\nPlazo para entregar el plan de acción: {data.plazo_entrega_plan}")
    if recomendaciones:
        partes.append("\nRecomendaciones (para tu conocimiento):")
        for r in recomendaciones:
            partes.append(f"  • {r}")
    partes.append("\nIngresa al sistema para completar tus acciones.")
    _notificar_usuarios_de_area(
        db, area,
        f"Nueva solicitud del Buzón de Sugerencias — {len(creadas)} acción(es), {len(recomendaciones)} recomendación(es)",
        "\n".join(partes),
    )
    return {
        "acciones": [{"id": a.id, "numero": a.numero} for a in creadas],
        "recomendaciones": len(recomendaciones),
    }


@app.get("/api/recomendaciones", response_model=List[RecomendacionOut])
def listar_recomendaciones(db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    query = db.query(Recomendacion)
    if usuario.rol != "admin":
        if not _norm_area(usuario.area):
            return []
        query = query.filter(func.lower(func.trim(Recomendacion.area)) == _norm_area(usuario.area))
    return query.order_by(Recomendacion.id.desc()).all()


@app.get("/api/areas", response_model=List[str])
def listar_areas(db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    """Áreas/carreras que ya tienen un usuario activo asignado (para el desplegable de nueva solicitud)."""
    usuarios = db.query(Usuario).filter(Usuario.rol == "usuario", Usuario.activo == True).all()
    return sorted({(u.area or "").strip() for u in usuarios if (u.area or "").strip()})


@app.post("/api/acciones-mejora/{accion_id}/observacion", response_model=AccionMejoraOut)
def observar_accion(accion_id: int, data: ObservacionCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    """La ingeniera deja un comentario para que el área corrija: estado 'Observada' + correo al área."""
    accion = db.query(AccionMejora).filter(AccionMejora.id == accion_id).first()
    if not accion:
        raise HTTPException(status_code=404, detail="Acción de Mejora no encontrada")
    texto = (data.texto or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Escribe el comentario para el área.")
    if accion.estado == "Cerrada":
        raise HTTPException(status_code=400, detail="No se puede observar una acción cerrada.")

    accion.estado = "Observada"
    accion.ultima_observacion = texto
    db.commit()
    _agregar_historial(db, accion, f"Observación de Sistemas de Gestión: {texto}")
    db.commit()
    _notificar_usuarios_de_area(
        db, accion.area_responsable,
        f"Observación en tu Acción de Mejora — {accion.numero}",
        f"Sistemas de Gestión dejó una observación en la acción {accion.numero}:\n\n{texto}\n\n"
        "Ingresa al sistema, corrige lo indicado y vuelve a enviar.",
    )
    db.refresh(accion)
    return accion


# --- Evidencias (archivos PDF / Excel / fotos) ---

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "evidencias")
EXTENSIONES_PERMITIDAS = {".pdf", ".xls", ".xlsx", ".csv", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp"}
TAMANO_MAX_BYTES = 15 * 1024 * 1024


@app.post("/api/acciones-mejora/{accion_id}/evidencias", response_model=AccionMejoraOut)
async def subir_evidencia(accion_id: int, archivo: UploadFile = File(...), db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    accion = db.query(AccionMejora).filter(AccionMejora.id == accion_id).first()
    if not accion:
        raise HTTPException(status_code=404, detail="Acción de Mejora no encontrada")
    _verificar_acceso_accion(usuario, accion)
    if usuario.rol != "admin" and accion.estado in ("Pendiente Plan de Acción", "Cerrada"):
        raise HTTPException(status_code=400, detail="Todavía no se puede subir evidencia en esta acción (completa primero el plan de acción).")

    extension = os.path.splitext(archivo.filename or "")[1].lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido. Usa PDF, Excel, Word o imágenes (JPG/PNG).")
    contenido = await archivo.read()
    if len(contenido) > TAMANO_MAX_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera el máximo de 15 MB.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    nombre_guardado = f"{uuid.uuid4().hex}{extension}"
    with open(os.path.join(UPLOAD_DIR, nombre_guardado), "wb") as f:
        f.write(contenido)

    db.add(EvidenciaArchivo(
        accion_id=accion.id,
        nombre_original=os.path.basename(archivo.filename or nombre_guardado),
        nombre_guardado=nombre_guardado,
        fecha=_ahora(),
        subido_por=usuario.nombre_completo,
    ))
    db.commit()
    _agregar_historial(db, accion, f"Evidencia subida: {archivo.filename}")
    db.commit()
    if usuario.rol != "admin":
        _notificar_admins(
            db,
            f"Evidencia subida — {accion.numero}",
            f"{usuario.nombre_completo} subió la evidencia '{archivo.filename}' a la Acción de Mejora {accion.numero}.",
        )
    db.refresh(accion)
    return accion


@app.get("/api/evidencias/{evidencia_id}/descargar")
def descargar_evidencia(evidencia_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_para_descarga)):
    ev = db.query(EvidenciaArchivo).filter(EvidenciaArchivo.id == evidencia_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    accion = db.query(AccionMejora).filter(AccionMejora.id == ev.accion_id).first()
    _verificar_acceso_accion(usuario, accion)
    ruta = os.path.join(UPLOAD_DIR, ev.nombre_guardado)
    if not os.path.exists(ruta):
        raise HTTPException(status_code=404, detail="El archivo ya no está en el servidor")
    return FileResponse(ruta, filename=ev.nombre_original)


@app.delete("/api/evidencias/{evidencia_id}", response_model=AccionMejoraOut)
def eliminar_evidencia(evidencia_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    ev = db.query(EvidenciaArchivo).filter(EvidenciaArchivo.id == evidencia_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    accion = db.query(AccionMejora).filter(AccionMejora.id == ev.accion_id).first()
    _verificar_acceso_accion(usuario, accion)
    if usuario.rol != "admin" and accion.estado == "Cerrada":
        raise HTTPException(status_code=400, detail="La acción está cerrada.")
    ruta = os.path.join(UPLOAD_DIR, ev.nombre_guardado)
    if os.path.exists(ruta):
        os.remove(ruta)
    nombre = ev.nombre_original
    db.delete(ev)
    db.commit()
    _agregar_historial(db, accion, f"Evidencia eliminada: {nombre}")
    db.commit()
    db.refresh(accion)
    return accion


@app.put("/api/acciones-mejora/{accion_id}/plan-accion", response_model=AccionMejoraOut)
def completar_plan_accion(accion_id: int, data: PlanAccionUpdate, db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    accion = db.query(AccionMejora).filter(AccionMejora.id == accion_id).first()
    if not accion:
        raise HTTPException(status_code=404, detail="Acción de Mejora no encontrada")
    _verificar_acceso_accion(usuario, accion)
    if accion.estado not in ("Pendiente Plan de Acción", "Observada"):
        raise HTTPException(status_code=400, detail="Esta acción no está pendiente de plan de acción")

    era_observada = accion.estado == "Observada"
    for key, value in data.dict(exclude_unset=True).items():
        setattr(accion, key, value)
    accion.fecha_llenado_parte1 = _ahora()
    accion.estado = "Pendiente Verificación"
    accion.ultima_observacion = None
    db.commit()
    _agregar_historial(
        db, accion,
        "Plan de acción corregido por el Área Responsable (tras observación)" if era_observada
        else "Plan de acción completado por el Área Responsable",
    )
    db.commit()
    _notificar_admins(
        db,
        f"Acción de Mejora lista para verificación — {accion.numero}",
        f"La Acción de Mejora {accion.numero} completó su plan de acción y está lista para verificación.",
    )
    db.refresh(accion)
    return accion


def _crear_accion_derivada(db: Session, original: AccionMejora) -> AccionMejora:
    numero = _generar_numero_ac(db, original.fuente_identificacion, original.sede)
    derivada = AccionMejora(
        numero=numero,
        estado="Pendiente Plan de Acción",
        fecha_creacion=_ahora(),
        declaracion_hallazgo=f"[Reincidencia de {original.numero}] {original.declaracion_hallazgo}",
        fuente_identificacion=original.fuente_identificacion,
        procesos=original.procesos,
        solicitante=original.solicitante,
        area_responsable=original.area_responsable,
        sede=original.sede,
    )
    db.add(derivada)
    db.commit()
    db.refresh(derivada)
    _agregar_historial(
        db, derivada,
        f"Creada automáticamente porque la verificación de {original.numero} resultó ineficaz",
    )
    db.commit()
    _notificar_usuarios_de_area(
        db, derivada.area_responsable,
        f"Nueva Acción de Mejora (reincidencia) — {derivada.numero}",
        f"Se abrió la Acción de Mejora {derivada.numero} porque {original.numero} no fue eficaz. Completa el plan de acción.",
    )
    return derivada


@app.put("/api/acciones-mejora/{accion_id}/verificacion", response_model=AccionMejoraOut)
def completar_verificacion(accion_id: int, data: VerificacionUpdate, db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    accion = db.query(AccionMejora).filter(AccionMejora.id == accion_id).first()
    if not accion:
        raise HTTPException(status_code=404, detail="Acción de Mejora no encontrada")
    if accion.estado != "Pendiente Verificación":
        raise HTTPException(status_code=400, detail="Esta acción no está pendiente de verificación")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(accion, key, value)
    accion.fecha_verificacion = _ahora()
    accion.estado = "Cerrada"

    evento = "Verificada y cerrada por Sistemas de Gestión (calidad)"
    if accion.es_ineficaz:
        nueva = _crear_accion_derivada(db, accion)
        accion.numero_accion_derivada = nueva.numero
        evento += f" — marcada como INEFICAZ, se abrió {nueva.numero} para continuar el seguimiento"

    db.commit()
    _agregar_historial(db, accion, evento)
    db.commit()
    db.refresh(accion)
    return accion


def _revisar_vencidas_y_notificar(db: Session):
    hoy = date.today().isoformat()
    vencidas = (
        db.query(AccionMejora)
        .filter(
            AccionMejora.estado == "Pendiente Plan de Acción",
            AccionMejora.plazo_entrega_plan.isnot(None),
            AccionMejora.plazo_entrega_plan != "",
        )
        .all()
    )
    for accion in vencidas:
        try:
            vencida = date.fromisoformat(accion.plazo_entrega_plan) < date.today()
        except ValueError:
            continue
        if not vencida:
            continue
        if accion.ultima_notificacion_vencimiento == hoy:
            continue

        _notificar_usuarios_de_area(
            db, accion.area_responsable,
            f"Recordatorio: plazo vencido — {accion.numero}",
            f"La Acción de Mejora {accion.numero} debía entregarse el {accion.plazo_entrega_plan} y todavía no se completó el plan de acción.",
        )
        accion.ultima_notificacion_vencimiento = hoy
        _agregar_historial(db, accion, f"Recordatorio automático de vencimiento enviado a {accion.area_responsable or 'Área Responsable'}")

    # Recordatorio de evidencia: llegó el plazo de ejecución y todavía no hay archivos subidos
    por_evidenciar = (
        db.query(AccionMejora)
        .filter(
            AccionMejora.estado == "Pendiente Verificación",
            AccionMejora.plazo_ejecucion.isnot(None),
            AccionMejora.plazo_ejecucion != "",
        )
        .all()
    )
    for accion in por_evidenciar:
        try:
            cumplido = date.fromisoformat(accion.plazo_ejecucion) <= date.today()
        except ValueError:
            continue
        if not cumplido or accion.evidencias or accion.ultima_notificacion_evidencia == hoy:
            continue
        _notificar_usuarios_de_area(
            db, accion.area_responsable,
            f"Recordatorio: sube tu evidencia — {accion.numero}",
            f"Se cumplió el plazo de ejecución ({accion.plazo_ejecucion}) de la Acción de Mejora {accion.numero}. "
            "Ingresa al sistema y sube la evidencia (PDF, Excel o fotos).",
        )
        accion.ultima_notificacion_evidencia = hoy
        _agregar_historial(db, accion, "Recordatorio automático: falta subir la evidencia")
    db.commit()


# =========================================================================
# Solicitudes — módulo INDEPENDIENTE de Acciones de Mejora.
# =========================================================================

def _agregar_historial_solicitud(db: Session, solicitud: Solicitud, evento: str):
    db.add(HistorialSolicitud(solicitud_id=solicitud.id, fecha=_ahora(), evento=evento))


def _verificar_acceso_solicitud(usuario: Usuario, solicitud: Solicitud):
    if usuario.rol != "admin" and (solicitud.destinatario_correo or "").lower() != (usuario.correo or "").lower():
        raise HTTPException(status_code=403, detail="Esta solicitud no fue enviada a tu cuenta.")


@app.get("/api/solicitudes", response_model=List[SolicitudOut])
def listar_solicitudes(db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    _revisar_solicitudes_vencidas(db)
    query = db.query(Solicitud).options(joinedload(Solicitud.historial))
    if usuario.rol != "admin":
        query = query.filter(Solicitud.destinatario_correo == usuario.correo)
    return query.order_by(Solicitud.id.desc()).all()


@app.post("/api/solicitudes", response_model=SolicitudOut)
def crear_solicitud(data: SolicitudCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    total = db.query(Solicitud).count()
    numero = f"SOL-{total + 1:04d}"
    solicitud = Solicitud(
        numero=numero,
        estado="Pendiente",
        fecha_envio=_ahora(),
        **data.dict(),
    )
    db.add(solicitud)
    db.commit()
    db.refresh(solicitud)
    _agregar_historial_solicitud(db, solicitud, f"Solicitud enviada a {data.destinatario_nombre or 'destinatario'}")
    db.commit()
    enviar_correo(
        data.destinatario_correo,
        f"Nueva solicitud — {numero}",
        f"Se te envió la solicitud {numero}: {data.asunto}",
    )
    db.refresh(solicitud)
    return solicitud


@app.put("/api/solicitudes/{solicitud_id}/responder", response_model=SolicitudOut)
def responder_solicitud(solicitud_id: int, data: SolicitudResponder, db: Session = Depends(get_db), usuario: Usuario = Depends(obtener_usuario_actual)):
    solicitud = db.query(Solicitud).filter(Solicitud.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    _verificar_acceso_solicitud(usuario, solicitud)

    ya_habia_respondido = solicitud.estado == "Respondida"

    for key, value in data.dict(exclude_unset=True).items():
        setattr(solicitud, key, value)
    solicitud.fecha_respuesta = _ahora()
    solicitud.estado = "Respondida"
    db.commit()
    if ya_habia_respondido:
        _agregar_historial_solicitud(db, solicitud, "Respuesta editada por el destinatario")
    else:
        _agregar_historial_solicitud(db, solicitud, "Respondida por el destinatario")
    db.commit()
    if ya_habia_respondido:
        _notificar_admins(db, f"Solicitud actualizada — {solicitud.numero}", f"El destinatario editó su respuesta a la solicitud {solicitud.numero}.")
    else:
        _notificar_admins(db, f"Solicitud respondida — {solicitud.numero}", f"La solicitud {solicitud.numero} fue respondida.")
    db.refresh(solicitud)
    return solicitud


@app.patch("/api/solicitudes/{solicitud_id}", response_model=SolicitudOut)
def editar_solicitud(solicitud_id: int, data: SolicitudEdicion, db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    solicitud = db.query(Solicitud).filter(Solicitud.id == solicitud_id).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(solicitud, key, value)
    db.commit()
    _agregar_historial_solicitud(db, solicitud, "Editada manualmente por Sistemas de Gestión (calidad)")
    db.commit()
    db.refresh(solicitud)
    return solicitud


def _revisar_solicitudes_vencidas(db: Session):
    hoy = date.today().isoformat()
    vencidas = (
        db.query(Solicitud)
        .filter(
            Solicitud.estado == "Pendiente",
            Solicitud.plazo_respuesta.isnot(None),
            Solicitud.plazo_respuesta != "",
        )
        .all()
    )
    for s in vencidas:
        try:
            vencida = date.fromisoformat(s.plazo_respuesta) < date.today()
        except ValueError:
            continue
        if not vencida or s.ultima_notificacion_vencimiento == hoy:
            continue
        enviar_correo(
            s.destinatario_correo,
            f"Recordatorio: solicitud vencida — {s.numero}",
            f"La solicitud {s.numero} ('{s.asunto}') venció el {s.plazo_respuesta} y no se respondió.",
        )
        s.ultima_notificacion_vencimiento = hoy
        _agregar_historial_solicitud(db, s, f"Recordatorio automático de vencimiento enviado a {s.destinatario_nombre or 'destinatario'}")
    db.commit()