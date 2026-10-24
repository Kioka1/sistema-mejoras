from pydantic import BaseModel
from typing import Optional, List


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


class RegistroCreate(RegistroBase):
    pass


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

class AccionMejoraCreate(BaseModel):
    """Registro de una Acción de Mejora — creación manual o transcripción directa desde el Excel."""
    declaracion_hallazgo: str
    fuente_identificacion: Optional[str] = None
    procesos: Optional[str] = None
    area_responsable: Optional[str] = None
    solicitante: Optional[str] = None
    plazo_entrega_plan: Optional[str] = None
    sede: Optional[str] = None
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    plan_accion: Optional[str] = None
    requiere_cambio_sgc: Optional[str] = None
    plazo_ejecucion: Optional[str] = None
    fecha_cierre_plan: Optional[str] = None
    observacion: Optional[str] = None
    numero_ac_original: Optional[str] = None
    estado: Optional[str] = None
    # Áreas responsables (puede ser más de una). Si no se envía, se usa area_responsable.
    areas: Optional[List[str]] = None
    # Plazo para que el área entregue el plan: 7 o 14 días desde hoy (lo elige Sistemas de Gestión).
    plazo_dias: Optional[int] = None


class PlanItemIn(BaseModel):
    """Una acción del plan con la evidencia que se presentará por ella."""
    accion: str
    evidencia: Optional[str] = None


class PlanItemOut(BaseModel):
    id: int
    orden: int
    accion_texto: str
    evidencia: Optional[str] = None

    class Config:
        from_attributes = True


class PlanAccionUpdate(BaseModel):
    """Primera Parte: llenado por el Área Responsable."""
    informe_investigacion: Optional[str] = None
    analisis_causa_raiz: Optional[str] = None
    correccion_inmediata: Optional[str] = None
    # Formato nuevo: una o más acciones, cada una con su evidencia
    acciones: Optional[List[PlanItemIn]] = None
    # Formato anterior (texto único); se sigue aceptando
    plan_accion: Optional[str] = None
    evidencia_parte1: Optional[str] = None
    responsables: Optional[str] = None
    plazo_ejecucion: Optional[str] = None


class VerificacionUpdate(BaseModel):
    """Etapa 3: Llenado exclusivo por la Coordinación de Sistemas de Gestión."""
    fecha_verificacion: Optional[str] = None
    descripcion_verificacion: Optional[str] = None
    evidencia_parte2: Optional[str] = None
    conclusion: Optional[str] = None
    coordinador_sistemas_gestion: Optional[str] = None
    es_ineficaz: Optional[bool] = False
    numero_accion_derivada: Optional[str] = None


class AccionMejoraEdicion(BaseModel):
    """Edición administrativa completa."""
    declaracion_hallazgo: Optional[str] = None
    fuente_identificacion: Optional[str] = None
    procesos: Optional[str] = None
    solicitante: Optional[str] = None
    area_responsable: Optional[str] = None
    sede: Optional[str] = None
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    numero_ac_original: Optional[str] = None
    estado: Optional[str] = None
    requiere_cambio_sgc: Optional[str] = None
    plazo_entrega_plan: Optional[str] = None
    plazo_ejecucion: Optional[str] = None
    fecha_cierre_plan: Optional[str] = None
    observacion: Optional[str] = None
    informe_investigacion: Optional[str] = None
    analisis_causa_raiz: Optional[str] = None
    correccion_inmediata: Optional[str] = None
    plan_accion: Optional[str] = None
    responsables: Optional[str] = None
    fecha_verificacion: Optional[str] = None
    descripcion_verificacion: Optional[str] = None
    evidencia_parte2: Optional[str] = None
    conclusion: Optional[str] = None
    coordinador_sistemas_gestion: Optional[str] = None
    es_ineficaz: Optional[bool] = None
    numero_accion_derivada: Optional[str] = None
    areas: Optional[List[str]] = None


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


class NotificacionesOut(BaseModel):
    no_leidas: int
    items: List[NotificacionOut]


class EvidenciaAsignar(BaseModel):         
    """Cambia a qué acción del plan corresponde un archivo (None = sin asignar)."""
    plan_item_id: Optional[int] = None

class RecomendacionOut(BaseModel):
    id: int
    area: str
    texto: str
    fecha: str

    class Config:
        from_attributes = True


class LoteAccionesCreate(BaseModel):
    """Una solicitud del buzón de sugerencias: varias acciones de mejora + recomendaciones para UNA misma área."""
    area: Optional[str] = None          # formato anterior (una sola área)
    areas: List[str] = []               # una o varias áreas destinatarias
    plazo_entrega_plan: Optional[str] = None
    plazo_dias: Optional[int] = None    # 7 o 14 días desde hoy
    solicitante: Optional[str] = None
    hallazgos: List[str] = []
    recomendaciones: List[str] = []


class ObservacionCreate(BaseModel):
    texto: str


class AccionMejoraOut(BaseModel):
    id: int
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

    class Config:
        from_attributes = True


# --- Solicitudes ---

class SolicitudCreate(BaseModel):
    asunto: str
    instrucciones: Optional[str] = None
    destinatario_nombre: Optional[str] = None
    destinatario_correo: Optional[str] = None
    plazo_respuesta: Optional[str] = None


class SolicitudResponder(BaseModel):
    informe_investigacion: Optional[str] = None
    analisis_causa_raiz: Optional[str] = None
    correccion_inmediata: Optional[str] = None
    plan_accion: Optional[str] = None
    evidencia: Optional[str] = None
    responsables: Optional[str] = None
    plazo_ejecucion: Optional[str] = None


class SolicitudEdicion(BaseModel):
    asunto: Optional[str] = None
    instrucciones: Optional[str] = None
    destinatario_nombre: Optional[str] = None
    destinatario_correo: Optional[str] = None
    plazo_respuesta: Optional[str] = None
    estado: Optional[str] = None
    informe_investigacion: Optional[str] = None
    analisis_causa_raiz: Optional[str] = None
    correccion_inmediata: Optional[str] = None
    plan_accion: Optional[str] = None
    evidencia: Optional[str] = None
    responsables: Optional[str] = None
    plazo_ejecucion: Optional[str] = None


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

class LoginRequest(BaseModel):
    correo: str
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str

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
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut

class UsuarioCreate(BaseModel):
    nombre_completo: str
    correo: str
    password: str
    rol: str  # "admin" | "usuario"
    sede: Optional[str] = None
    area: Optional[str] = None          # formato anterior
    areas: List[str] = []               # una o varias áreas


class UsuarioEdicion(BaseModel):
    nombre_completo: Optional[str] = None
    sede: Optional[str] = None
    area: Optional[str] = None          # formato anterior
    areas: Optional[List[str]] = None   # una o varias áreas
    activo: Optional[bool] = None
    password: Optional[str] = None


class AreaCreate(BaseModel):
    nombre: str  

    