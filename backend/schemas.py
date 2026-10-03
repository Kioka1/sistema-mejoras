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


class PlanAccionUpdate(BaseModel):
    """Etapa 2: Llenado por el Área Responsable."""
    informe_investigacion: Optional[str] = None
    analisis_causa_raiz: Optional[str] = None
    correccion_inmediata: Optional[str] = None
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


class EvidenciaOut(BaseModel):
    id: int
    nombre_original: str
    fecha: str
    subido_por: Optional[str] = None

    class Config:
        from_attributes = True


class RecomendacionOut(BaseModel):
    id: int
    area: str
    texto: str
    fecha: str

    class Config:
        from_attributes = True


class LoteAccionesCreate(BaseModel):
    """Una solicitud del buzón de sugerencias: varias acciones de mejora + recomendaciones para UNA misma área."""
    area: str
    plazo_entrega_plan: Optional[str] = None
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
    area: Optional[str] = None


class UsuarioEdicion(BaseModel):
    nombre_completo: Optional[str] = None
    sede: Optional[str] = None
    area: Optional[str] = None
    activo: Optional[bool] = None
    password: Optional[str] = None  

    