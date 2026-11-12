from datetime import date
from typing import Annotated, List, Literal, Optional
import re

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StrictBool, StringConstraints, field_validator


def sin_controles(valor: str) -> str:
    if re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", valor):
        raise ValueError("El texto contiene caracteres de control.")
    return valor


def validar_fecha(valor: str) -> str:
    if not valor:
        return valor
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", valor):
        raise ValueError("Usa una fecha AAAA-MM-DD.")
    date.fromisoformat(valor)
    return valor


def limite_bcrypt(valor: str) -> str:
    if len(valor.encode("utf-8")) > 72 or "\x00" in valor:
        raise ValueError("La contraseña supera el límite de 72 bytes o contiene un carácter inválido.")
    return valor


Texto = Annotated[str, StringConstraints(strip_whitespace=True, max_length=12000), AfterValidator(sin_controles)]
TextoRequerido = Annotated[Texto, Field(min_length=1)]
Etiqueta = Annotated[Texto, Field(max_length=240)]
EtiquetaRequerida = Annotated[Etiqueta, Field(min_length=1)]
Nombre = Annotated[EtiquetaRequerida, Field(max_length=160)]
FechaISO = Annotated[Etiqueta, AfterValidator(validar_fecha)]
Correo = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=254,
                    pattern=r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")]
PasswordLogin = Annotated[str, StringConstraints(min_length=1, max_length=72), AfterValidator(limite_bcrypt)]
PasswordNueva = Annotated[PasswordLogin, Field(min_length=12)]
IdPositivo = Annotated[int, Field(strict=True, gt=0, le=2147483647)]
DiasPlazo = Annotated[int, Field(strict=True, ge=1, le=365)]
Areas = Annotated[List[EtiquetaRequerida], Field(max_length=50)]
TextosLote = Annotated[List[Texto], Field(max_length=100)]
EstadoAccion = Literal["Pendiente Plan de Acción", "Observada", "En ejecución", "Pendiente de evidencia",
                       "Pendiente Verificación", "Cerrada", "Ineficaz"]


class Entrada(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)



# --- Registros ---

class RegistroBase(BaseModel):
    tipo: str
    titulo: str
    sistema: str
    categoria: str
    prioridad: str
    estado: str
    fecha: str
    descripcion: Optional[str] = None


class RegistroCreate(Entrada):
    tipo: Literal["Incidencia", "Oportunidad de mejora"]
    titulo: EtiquetaRequerida
    sistema: EtiquetaRequerida
    categoria: EtiquetaRequerida
    prioridad: Literal["Alta", "Media", "Baja"]
    estado: Literal["Nuevo", "En revisión", "Resuelto"]
    fecha: FechaISO
    descripcion: Optional[Texto] = None


class RegistroOut(RegistroBase):
    id: int

    class Config:
        from_attributes = True


# --- Historial Genérico ---

class HistorialOut(BaseModel):
    fecha: str
    evento: str

    class Config:
        from_attributes = True


# --- Acciones de Mejora ---

class AccionMejoraCreate(Entrada):
    """Registro de una Acción de Mejora — creación manual o transcripción directa desde el Excel."""
    declaracion_hallazgo: TextoRequerido
    fuente_identificacion: Optional[Etiqueta] = None
    procesos: Optional[Etiqueta] = None
    area_responsable: Optional[Etiqueta] = None
    solicitante: Optional[Etiqueta] = None
    plazo_entrega_plan: Optional[FechaISO] = None
    sede: Optional[Etiqueta] = None
    categoria: Optional[Etiqueta] = None
    subcategoria: Optional[Etiqueta] = None
    plan_accion: Optional[Texto] = None
    requiere_cambio_sgc: Optional[Etiqueta] = None
    plazo_ejecucion: Optional[FechaISO] = None
    fecha_cierre_plan: Optional[Etiqueta] = None
    observacion: Optional[Texto] = None
    numero_ac_original: Optional[Etiqueta] = None
    estado: Optional[EstadoAccion] = None
    # Áreas responsables (puede ser más de una). Si no se envía, se usa area_responsable.
    areas: Optional[Areas] = None
    # Plazo para que el área entregue el plan: días hábiles desde el envío (10 por defecto) (lo elige Sistemas de Gestión).
    plazo_dias: Optional[DiasPlazo] = None


class PlanItemIn(Entrada):
    """Una acción del plan con la evidencia que se presentará por ella."""
    accion: TextoRequerido
    evidencia: Optional[Texto] = None


class PlanItemOut(BaseModel):
    id: int
    orden: int
    accion_texto: str
    evidencia: Optional[str] = None

    class Config:
        from_attributes = True


class PlanAccionUpdate(Entrada):
    """Primera Parte: llenado por el Área Responsable."""
    informe_investigacion: Optional[Texto] = None
    analisis_causa_raiz: Optional[Texto] = None
    correccion_inmediata: Optional[Texto] = None
    # Formato nuevo: una o más acciones, cada una con su evidencia
    acciones: Optional[Annotated[List[PlanItemIn], Field(max_length=100)]] = None
    # Formato anterior (texto único); se sigue aceptando
    plan_accion: Optional[Texto] = None
    evidencia_parte1: Optional[Texto] = None
    responsables: Optional[Etiqueta] = None
    plazo_ejecucion: Optional[FechaISO] = None


class VerificacionUpdate(Entrada):
    """Etapa 3: Llenado exclusivo por la Coordinación de Sistemas de Gestión."""
    fecha_verificacion: Optional[FechaISO] = None
    descripcion_verificacion: Optional[Texto] = None
    evidencia_parte2: Optional[Texto] = None
    conclusion: Optional[Texto] = None
    coordinador_sistemas_gestion: Optional[Etiqueta] = None
    es_ineficaz: Optional[StrictBool] = False
    numero_accion_derivada: Optional[Etiqueta] = None


class AccionMejoraEdicion(Entrada):
    """Edición administrativa completa."""
    declaracion_hallazgo: Optional[TextoRequerido] = None
    fuente_identificacion: Optional[Etiqueta] = None
    procesos: Optional[Etiqueta] = None
    solicitante: Optional[Etiqueta] = None
    area_responsable: Optional[Etiqueta] = None
    sede: Optional[Etiqueta] = None
    categoria: Optional[Etiqueta] = None
    subcategoria: Optional[Etiqueta] = None
    numero_ac_original: Optional[Etiqueta] = None
    estado: Optional[EstadoAccion] = None
    requiere_cambio_sgc: Optional[Etiqueta] = None
    plazo_entrega_plan: Optional[FechaISO] = None
    plazo_ejecucion: Optional[FechaISO] = None
    fecha_cierre_plan: Optional[Etiqueta] = None
    observacion: Optional[Texto] = None
    informe_investigacion: Optional[Texto] = None
    analisis_causa_raiz: Optional[Texto] = None
    correccion_inmediata: Optional[Texto] = None
    plan_accion: Optional[Texto] = None
    responsables: Optional[Etiqueta] = None
    fecha_verificacion: Optional[FechaISO] = None
    descripcion_verificacion: Optional[Texto] = None
    evidencia_parte2: Optional[Texto] = None
    conclusion: Optional[Texto] = None
    coordinador_sistemas_gestion: Optional[Etiqueta] = None
    es_ineficaz: Optional[StrictBool] = None
    numero_accion_derivada: Optional[Etiqueta] = None
    areas: Optional[Areas] = None

    @field_validator('declaracion_hallazgo', 'estado')
    @classmethod
    def rechazar_nulos(cls, valor):
        if valor is None:
            raise ValueError("El campo no puede ser nulo.")
        return valor



class EvidenciaOut(BaseModel):
    id: int
    nombre_original: str
    fecha: str
    subido_por: Optional[str] = None
    plan_item_id: Optional[int] = None

    class Config:
        from_attributes = True


# --- Notificaciones del sistema ---

class NotificacionOut(BaseModel):
    id: int
    asunto: str
    mensaje: str
    fecha: str
    leida: bool
    accion_id: Optional[int] = None

    class Config:
        from_attributes = True


class AlertaPlazoOut(BaseModel):
    tipo: str
    fecha: str
    nivel: str
    texto: str


class AvisoPendienteOut(AlertaPlazoOut):
    accion_id: int
    numero: str
    areas: List[str] = []
    estado: Optional[str] = None


class NotificacionesOut(BaseModel):
    no_leidas: int
    items: List[NotificacionOut]
    pendientes: List[AvisoPendienteOut] = []


class EvidenciaAsignar(Entrada):
    """Cambia a qué acción del plan corresponde un archivo (None = sin asignar)."""
    plan_item_id: Optional[IdPositivo] = None

class RecomendacionOut(BaseModel):
    id: int
    area: str
    texto: str
    fecha: str

    class Config:
        from_attributes = True


class LoteAccionesCreate(Entrada):
    """Una solicitud del buzón de sugerencias: varias acciones de mejora + recomendaciones para UNA misma área."""
    area: Optional[Etiqueta] = None          # formato anterior (una sola área)
    areas: Areas = []               # una o varias áreas destinatarias
    plazo_entrega_plan: Optional[FechaISO] = None
    plazo_dias: Optional[DiasPlazo] = None    # días hábiles desde el envío (10 por defecto)
    solicitante: Optional[Etiqueta] = None
    procesos: Optional[Etiqueta] = None
    hallazgos: TextosLote = []
    recomendaciones: TextosLote = []


class ObservacionCreate(Entrada):
    texto: TextoRequerido


class FormularioHistoricoOut(BaseModel):
    id: int
    nombre_original: str
    fecha_importacion: str
    importado_por: str
    seguimiento_activo: bool

    class Config:
        from_attributes = True


class AccionMejoraOut(BaseModel):
    id: int
    plazo_evidencias: Optional[str] = None
    alerta_plazo: Optional[AlertaPlazoOut] = None
    numero: str
    estado: str
    declaracion_hallazgo: str
    fuente_identificacion: Optional[str] = None
    procesos: Optional[str] = None
    fecha_creacion: str
    solicitante: Optional[str] = None
    plazo_entrega_plan: Optional[str] = None
    area_responsable: Optional[str] = None
    sede: Optional[str] = None
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    numero_ac_original: Optional[str] = None
    estado_original: Optional[str] = None
    requiere_cambio_sgc: Optional[str] = None
    fecha_cierre_plan: Optional[str] = None
    observacion: Optional[str] = None
    informe_investigacion: Optional[str] = None
    analisis_causa_raiz: Optional[str] = None
    correccion_inmediata: Optional[str] = None
    plan_accion: Optional[str] = None
    evidencia_parte1: Optional[str] = None
    responsables: Optional[str] = None
    plazo_ejecucion: Optional[str] = None
    fecha_llenado_parte1: Optional[str] = None
    fecha_verificacion: Optional[str] = None
    descripcion_verificacion: Optional[str] = None
    evidencia_parte2: Optional[str] = None
    conclusion: Optional[str] = None
    coordinador_sistemas_gestion: Optional[str] = None
    es_ineficaz: Optional[bool] = False
    numero_accion_derivada: Optional[str] = None
    ultima_observacion: Optional[str] = None
    areas: List[str] = []
    plan_items: List[PlanItemOut] = []
    evidencias: List[EvidenciaOut] = []
    historial: List[HistorialOut] = []
    formulario_historico: Optional[FormularioHistoricoOut] = None

    class Config:
        from_attributes = True


# --- Solicitudes ---

class SolicitudCreate(Entrada):
    asunto: EtiquetaRequerida
    instrucciones: Optional[Texto] = None
    destinatario_nombre: Optional[Etiqueta] = None
    destinatario_correo: Optional[Correo | Literal[""]] = None
    plazo_respuesta: Optional[FechaISO] = None


class SolicitudResponder(Entrada):
    informe_investigacion: Optional[Texto] = None
    analisis_causa_raiz: Optional[Texto] = None
    correccion_inmediata: Optional[Texto] = None
    plan_accion: Optional[Texto] = None
    evidencia: Optional[Texto] = None
    responsables: Optional[Etiqueta] = None
    plazo_ejecucion: Optional[FechaISO] = None


class SolicitudEdicion(Entrada):
    asunto: Optional[EtiquetaRequerida] = None
    instrucciones: Optional[Texto] = None
    destinatario_nombre: Optional[Etiqueta] = None
    destinatario_correo: Optional[Correo | Literal[""]] = None
    plazo_respuesta: Optional[FechaISO] = None
    estado: Optional[Literal["Pendiente", "Respondida"]] = None
    informe_investigacion: Optional[Texto] = None
    analisis_causa_raiz: Optional[Texto] = None
    correccion_inmediata: Optional[Texto] = None
    plan_accion: Optional[Texto] = None
    evidencia: Optional[Texto] = None
    responsables: Optional[Etiqueta] = None
    plazo_ejecucion: Optional[FechaISO] = None

    @field_validator('asunto', 'estado')
    @classmethod
    def rechazar_nulos(cls, valor):
        if valor is None:
            raise ValueError("El campo no puede ser nulo.")
        return valor



class SolicitudOut(BaseModel):
    id: int
    numero: str
    estado: str
    asunto: str
    instrucciones: Optional[str] = None
    destinatario_nombre: Optional[str] = None
    destinatario_correo: Optional[str] = None
    fecha_envio: str
    plazo_respuesta: Optional[str] = None
    fecha_respuesta: Optional[str] = None
    informe_investigacion: Optional[str] = None
    analisis_causa_raiz: Optional[str] = None
    correccion_inmediata: Optional[str] = None
    plan_accion: Optional[str] = None
    evidencia: Optional[str] = None
    responsables: Optional[str] = None
    plazo_ejecucion: Optional[str] = None
    historial: List[HistorialOut] = []

    class Config:
        from_attributes = True


# --- Autenticación y Usuarios ---

class LoginRequest(Entrada):
    correo: Correo
    password: PasswordLogin

class GoogleLoginRequest(Entrada):
    credential: Annotated[str, StringConstraints(max_length=8192, pattern=r"^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$")]
    password_vinculacion: Optional[PasswordLogin] = None

class UsuarioOut(BaseModel):
    id: int
    nombre_completo: str
    correo: str
    rol: str
    sede: Optional[str] = None
    area: Optional[str] = None
    areas: List[str] = []
    activo: bool

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    usuario: UsuarioOut

class UsuarioCreate(Entrada):
    nombre_completo: Nombre
    correo: Correo
    password: PasswordNueva
    rol: Literal["admin", "usuario"]  # "admin" | "usuario"
    sede: Optional[Etiqueta] = None
    area: Optional[Etiqueta] = None          # formato anterior
    areas: Areas = []               # una o varias áreas


class UsuarioEdicion(Entrada):
    nombre_completo: Optional[Nombre] = None
    sede: Optional[Etiqueta] = None
    area: Optional[Etiqueta] = None          # formato anterior
    areas: Optional[Areas] = None   # una o varias áreas
    activo: Optional[StrictBool] = None
    password: Optional[PasswordNueva] = None

    @field_validator('nombre_completo', 'activo')
    @classmethod
    def rechazar_nulos(cls, valor):
        if valor is None:
            raise ValueError("El campo no puede ser nulo.")
        return valor



class AreaCreate(Entrada):
    nombre: EtiquetaRequerida


