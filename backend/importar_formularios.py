"""Importación histórica con revisión humana y conservación del Word original."""
from datetime import date, datetime
from hashlib import sha256
from pathlib import Path
import re
from typing import Annotated, Literal, Optional
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Path as ParametroRuta
from fastapi.responses import FileResponse
from pydantic import Field, StrictBool, ValidationError
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import requerir_admin, obtener_usuario_actual
from database import (get_db, Usuario, AccionMejora, FormularioHistorico, HistorialAccion,
                      Area, asignar_areas)
from leer_formulario import leer_formulario, codigo_normalizado, MAX_ARCHIVO
from seguridad_archivos import nombre_archivo_seguro
from schemas import AccionMejoraOut, FormularioHistoricoOut, Entrada, Areas, EtiquetaRequerida, Texto, TextoRequerido

router = APIRouter()
DIRECTORIO = Path(__file__).resolve().parent / 'uploads' / 'formularios_historicos'


class DatosHistoricos(Entrada):
    hash_archivo: str = Field(pattern=r'^[a-f0-9]{64}$')
    numero_ac_original: EtiquetaRequerida
    declaracion_hallazgo: TextoRequerido
    estado: Literal['Pendiente Plan de Acción', 'Observada', 'En ejecución', 'Pendiente de evidencia', 'Pendiente Verificación', 'Cerrada']
    areas: Areas = Field(min_length=1)
    sede: EtiquetaRequerida
    activar_seguimiento: StrictBool = False
    fuente_identificacion: Optional[Texto] = None
    procesos: Optional[Texto] = None
    fecha_creacion: Optional[Texto] = None
    plazo_entrega_plan: Optional[Texto] = None
    informe_investigacion: Optional[Texto] = None
    analisis_causa_raiz: Optional[Texto] = None
    correccion_inmediata: Optional[Texto] = None
    plan_accion: Optional[Texto] = None
    evidencia_parte1: Optional[Texto] = None
    responsables: Optional[Texto] = None
    plazo_ejecucion: Optional[Texto] = None
    fecha_llenado_parte1: Optional[Texto] = None
    fecha_verificacion: Optional[Texto] = None
    descripcion_verificacion: Optional[Texto] = None
    evidencia_parte2: Optional[Texto] = None
    conclusion: Optional[Texto] = None
    coordinador_sistemas_gestion: Optional[Texto] = None
    numero_accion_derivada: Optional[Texto] = None
    observacion: Optional[Texto] = None


class SeguimientoHistorico(Entrada):
    activo: StrictBool


def validar_seguimiento(estado, plazo_entrega_plan, plazo_ejecucion):
    campo, valor = ('plazo de entrega del formulario', plazo_entrega_plan) if estado == 'Pendiente Plan de Acción' else ('plazo de ejecución', plazo_ejecucion)
    try:
        date.fromisoformat(valor or '')
    except ValueError:
        raise HTTPException(status_code=400, detail=f'Para activar los recordatorios completa el {campo} con una fecha AAAA-MM-DD.')


def duplicado(db, codigo, hash_archivo):
    origen = db.query(FormularioHistorico).filter(FormularioHistorico.sha256 == hash_archivo).first()
    if origen:
        return origen.accion
    clave = codigo_normalizado(codigo)
    if clave:
        for accion in db.query(AccionMejora).all():
            if clave in {codigo_normalizado(accion.numero), codigo_normalizado(accion.numero_ac_original)}:
                return accion
    return None


async def contenido_word(archivo):
    if not (archivo.filename or '').lower().endswith('.docx'):
        raise HTTPException(status_code=400, detail='Selecciona un formulario Word .docx. No se admiten .doc ni PDF en esta opción.')
    contenido = await archivo.read(MAX_ARCHIVO + 1)
    try:
        lectura = leer_formulario(contenido)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return contenido, lectura


@router.post('/api/acciones-mejora/previsualizar-formulario')
async def previsualizar_formulario(archivo: UploadFile = File(...), db: Session = Depends(get_db),
                                  usuario: Usuario = Depends(requerir_admin)):
    _, lectura = await contenido_word(archivo)
    existente = duplicado(db, lectura['datos'].get('numero_ac_original'), lectura['hash_archivo'])
    lectura['duplicado'] = {'id': existente.id, 'numero': existente.numero} if existente else None
    return lectura


def guardar_historico(db, usuario, datos, contenido, nombre):
    codigo = datos.numero_ac_original.strip()
    if not codigo or re.search(r'\bXX\b', codigo, re.I) or len(codigo) > 120:
        raise HTTPException(status_code=400, detail='Indica el número real de la acción, sin los XX de la plantilla.')
    if not datos.declaracion_hallazgo.strip():
        raise HTTPException(status_code=400, detail='Completa la declaración del hallazgo.')
    if not datos.sede.strip():
        raise HTTPException(status_code=400, detail='Selecciona la sede del caso histórico.')
    if sha256(contenido).hexdigest() != datos.hash_archivo:
        raise HTTPException(status_code=400, detail='El archivo cambió después de la revisión. Vuelve a seleccionarlo.')
    nombres = list(dict.fromkeys(n.strip() for n in datos.areas if n.strip()))
    existentes = {a.nombre for a in db.query(Area).filter(Area.activa == True).all()}
    if not nombres or any(n not in existentes for n in nombres):
        raise HTTPException(status_code=400, detail='Selecciona al menos un área activa del catálogo.')
    if datos.activar_seguimiento and datos.estado != 'Cerrada':
        validar_seguimiento(datos.estado, datos.plazo_entrega_plan, datos.plazo_ejecucion)
    if db.get_bind().dialect.name == 'postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(hashtext(:codigo))'), {'codigo': codigo_normalizado(codigo)})
    if duplicado(db, codigo, datos.hash_archivo):
        raise HTTPException(status_code=409, detail='Ese formulario o número de acción ya está registrado. No se creó un duplicado.')
    valores = datos.model_dump(exclude={'hash_archivo', 'areas', 'activar_seguimiento'})
    valores['numero_ac_original'] = codigo
    valores['fecha_creacion'] = datos.fecha_creacion or ''
    accion = AccionMejora(numero=codigo, estado_original=datos.estado, **valores)
    fecha = datetime.now().strftime('%Y-%m-%d %H:%M')
    ruta = None
    try:
        db.add(accion)
        db.flush()
        asignar_areas(db, accion, nombres)
        DIRECTORIO.mkdir(parents=True, exist_ok=True)
        guardado = f'{uuid.uuid4().hex}.docx'
        ruta = (DIRECTORIO / guardado).resolve()
        with ruta.open('xb') as salida:
            salida.write(contenido)
        db.add(FormularioHistorico(
            accion_id=accion.id, nombre_original=Path(nombre.replace('\\', '/')).name,
            nombre_guardado=guardado, sha256=datos.hash_archivo, fecha_importacion=fecha,
            importado_por=usuario.nombre_completo,
            seguimiento_activo=datos.activar_seguimiento and datos.estado != 'Cerrada',
        ))
        db.add(HistorialAccion(accion_id=accion.id, fecha=fecha,
            evento=f'Formulario histórico importado por {usuario.nombre_completo}. Estado confirmado: {datos.estado}. '
                   + ('Seguimiento activo.' if datos.activar_seguimiento and datos.estado != 'Cerrada' else 'Sin recordatorios automáticos.')))
        db.commit()
    except Exception as error:
        db.rollback()
        if ruta is not None and ruta.parent == DIRECTORIO.resolve() and ruta.is_file():
            ruta.unlink()
        if isinstance(error, IntegrityError):
            raise HTTPException(status_code=409, detail='El formulario ya fue importado. No se creó un duplicado.')
        raise
    db.refresh(accion)
    return accion


@router.post('/api/acciones-mejora/importar-formulario', response_model=AccionMejoraOut)
async def importar_formulario(archivo: UploadFile = File(...), datos: str = Form(...),
                             db: Session = Depends(get_db), usuario: Usuario = Depends(requerir_admin)):
    contenido, _ = await contenido_word(archivo)
    try:
        revisados = DatosHistoricos.model_validate_json(datos)
        nombre = nombre_archivo_seguro(archivo.filename)
    except (ValidationError, ValueError):
        raise HTTPException(status_code=400, detail='Revisa el código, hallazgo, estado, sede y áreas antes de importar.')
    return guardar_historico(db, usuario, revisados, contenido, nombre)


@router.get('/api/formularios-historicos/{formulario_id}/descargar')
def descargar_original(formulario_id: Annotated[int, ParametroRuta(gt=0, le=2147483647)], db: Session = Depends(get_db),
                       usuario: Usuario = Depends(obtener_usuario_actual)):
    origen = db.query(FormularioHistorico).filter(FormularioHistorico.id == formulario_id).first()
    if not origen:
        raise HTTPException(status_code=404, detail='Formulario original no encontrado.')
    if usuario.rol != 'admin' and not ({a.id for a in usuario.areas_rel} & {a.id for a in origen.accion.areas_rel}):
        raise HTTPException(status_code=403, detail='Este formulario no corresponde a tu área.')
    ruta = (DIRECTORIO / origen.nombre_guardado).resolve()
    if ruta.parent != DIRECTORIO.resolve() or not ruta.is_file():
        raise HTTPException(status_code=404, detail='El archivo original no está disponible.')
    return FileResponse(ruta, filename=origen.nombre_original,
                        media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        headers={'Cache-Control': 'no-store'})


@router.patch('/api/formularios-historicos/{formulario_id}/seguimiento', response_model=FormularioHistoricoOut)
def cambiar_seguimiento(formulario_id: Annotated[int, ParametroRuta(gt=0, le=2147483647)], datos: SeguimientoHistorico, db: Session = Depends(get_db),
                        usuario: Usuario = Depends(requerir_admin)):
    origen = db.query(FormularioHistorico).filter(FormularioHistorico.id == formulario_id).first()
    if not origen:
        raise HTTPException(status_code=404, detail='Formulario histórico no encontrado.')
    if datos.activo:
        if origen.accion.estado == 'Cerrada':
            raise HTTPException(status_code=400, detail='Una acción cerrada no necesita seguimiento.')
        validar_seguimiento(origen.accion.estado, origen.accion.plazo_entrega_plan, origen.accion.plazo_ejecucion)
    origen.seguimiento_activo = datos.activo
    db.add(HistorialAccion(accion_id=origen.accion_id, fecha=datetime.now().strftime('%Y-%m-%d %H:%M'),
        evento=f'{usuario.nombre_completo} ' + ('activó' if datos.activo else 'desactivó') + ' el seguimiento del caso histórico.'))
    db.commit()
    db.refresh(origen)
    return origen
