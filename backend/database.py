"""
Configuración de la base de datos — PostgreSQL.
Sistematización de Acciones de Mejora (CAPA) y Solicitudes.
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, Boolean, Table, func
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import os
import re

# --- Configuración de PostgreSQL ---
PG_USER = os.environ.get("DB_USER", "postgres")
PG_PASSWORD = os.environ.get("DB_PASSWORD", "TU_CONTRASEÑA_AQUI")
PG_HOST = os.environ.get("DB_HOST", "localhost")
PG_PORT = os.environ.get("DB_PORT", "5432")
PG_NAME = os.environ.get("DB_NAME", "sistema_mejoras")

# DATABASE_URL completa (opcional): útil para pruebas, ej. sqlite:///prueba.db
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_NAME}",
)

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- Áreas / Carreras (un usuario puede tener varias; una acción puede ser de varias) ---

usuario_areas = Table(
    "usuario_areas",
    Base.metadata,
    Column("usuario_id", Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True),
    Column("area_id", Integer, ForeignKey("areas.id", ondelete="CASCADE"), primary_key=True),
)

accion_areas = Table(
    "accion_areas",
    Base.metadata,
    Column("accion_id", Integer, ForeignKey("acciones_mejora.id", ondelete="CASCADE"), primary_key=True),
    Column("area_id", Integer, ForeignKey("areas.id", ondelete="CASCADE"), primary_key=True),
)


class Area(Base):
    """Catálogo de áreas/carreras (ej. ODO, DAF, TI). Se administra desde Usuarios."""

    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False, unique=True, index=True)
    activa = Column(Boolean, nullable=False, default=True)


class Registro(Base):
    """Registro de incidencias u oportunidades generales de mejora."""

    __tablename__ = "registros"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String, nullable=False)          # "Incidencia" | "Oportunidad de mejora"
    titulo = Column(String, nullable=False)
    sistema = Column(String, nullable=False)
    categoria = Column(String, nullable=False)
    prioridad = Column(String, nullable=False)      # "Alta" | "Media" | "Baja"
    estado = Column(String, nullable=False)         # "Nuevo" | "En revisión" | "Resuelto"
    fecha = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)


class AccionMejora(Base):
    """
    Formulario de Acción de Mejora (tipo CAPA) estructurado en 3 etapas:
      1. Registro Inicial (Sistemas de Gestión)
      2. Investigación y Plan de Acción (Área Responsable)
      3. Verificación de Eficacia y Cierre (Sistemas de Gestión / Coordinación)
    """

    __tablename__ = "acciones_mejora"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String, nullable=False)
    estado = Column(String, nullable=False, default="Pendiente Plan de Acción")
    # Estados: "Pendiente Plan de Acción" | "Pendiente Verificación" | "Cerrada" | "Ineficaz"

    # --- ETAPA 1: Registro Inicial (Sistemas de Gestión) ---
    declaracion_hallazgo = Column(Text, nullable=False)
    fuente_identificacion = Column(String, nullable=True)
    procesos = Column(String, nullable=True)
    categoria = Column(String, nullable=True)
    subcategoria = Column(String, nullable=True)
    fecha_creacion = Column(String, nullable=False)
    solicitante = Column(String, nullable=True)
    plazo_entrega_plan = Column(String, nullable=True)  # Plazo para que el área entregue la Etapa 2
    sede = Column(String, nullable=True)
    numero_ac_original = Column(String, nullable=True)  # Código si proviene de migración Excel
    estado_original = Column(String, nullable=True)
    requiere_cambio_sgc = Column(String, nullable=True)
    fecha_cierre_plan = Column(String, nullable=True)
    observacion = Column(Text, nullable=True)

    # --- ETAPA 2: Análisis y Plan de Acción (Área Responsable) ---
    area_responsable = Column(String, nullable=True)
    informe_investigacion = Column(Text, nullable=True)
    analisis_causa_raiz = Column(Text, nullable=True)    # Soporte para 5 Porqués, Pescado, 5W2H
    correccion_inmediata = Column(Text, nullable=True)
    plan_accion = Column(Text, nullable=True)
    evidencia_parte1 = Column(Text, nullable=True)        # Archivos/enlaces de respaldo
    responsables = Column(String, nullable=True)
    plazo_ejecucion = Column(String, nullable=True)
    fecha_llenado_parte1 = Column(String, nullable=True)
    ultima_notificacion_vencimiento = Column(String, nullable=True)
    ultima_observacion = Column(Text, nullable=True)      # Comentario pendiente de Sistemas de Gestión (estado "Observada")
    ultima_notificacion_evidencia = Column(String, nullable=True)

    # --- ETAPA 3: Verificación y Cierre (Coordinador de Sistemas de Gestión) ---
    fecha_verificacion = Column(String, nullable=True)
    descripcion_verificacion = Column(Text, nullable=True)
    evidencia_parte2 = Column(Text, nullable=True)        # Evidencia de seguimiento/verificación
    conclusion = Column(Text, nullable=True)
    coordinador_sistemas_gestion = Column(String, nullable=True, default="Sistemas de Gestión")

    # Manejo de re-apertura si fue ineficaz
    es_ineficaz = Column(Boolean, default=False)
    numero_accion_derivada = Column(String, nullable=True) # N° Nueva Acción de Mejora vinculada

    historial = relationship("HistorialAccion", backref="accion", cascade="all, delete-orphan")
    evidencias = relationship("EvidenciaArchivo", backref="accion", cascade="all, delete-orphan")
    # Primera Parte: lista de acciones del plan, cada una con su evidencia prevista
    plan_items = relationship(
        "PlanAccionItem",
        backref="accion",
        cascade="all, delete-orphan",
        order_by="PlanAccionItem.orden",
        lazy="selectin",
    )
    # Áreas responsables (puede ser más de una)
    areas_rel = relationship("Area", secondary=accion_areas, lazy="selectin")

    @property
    def areas(self):
        return sorted(a.nombre for a in self.areas_rel)


class PlanAccionItem(Base):
    """Una acción del Plan de Acción (Primera Parte) con la evidencia que se presentará por ella."""

    __tablename__ = "plan_accion_items"

    id = Column(Integer, primary_key=True, index=True)
    accion_id = Column(Integer, ForeignKey("acciones_mejora.id"), nullable=False, index=True)
    orden = Column(Integer, nullable=False, default=0)
    accion_texto = Column(Text, nullable=False)
    evidencia = Column(Text, nullable=True)


class EvidenciaArchivo(Base):
    """Archivos de evidencia (PDF, Excel, fotos) que sube el Área Responsable."""

    __tablename__ = "evidencias_archivos"

    id = Column(Integer, primary_key=True, index=True)
    accion_id = Column(Integer, ForeignKey("acciones_mejora.id"), nullable=False)
    nombre_original = Column(String, nullable=False)
    nombre_guardado = Column(String, nullable=False)
    fecha = Column(String, nullable=False)
    subido_por = Column(String, nullable=True)


class Recomendacion(Base):
    """Recomendaciones del buzón de sugerencias, enviadas junto con las acciones de mejora."""

    __tablename__ = "recomendaciones"

    id = Column(Integer, primary_key=True, index=True)
    area = Column(String, nullable=False, index=True)
    texto = Column(Text, nullable=False)
    fecha = Column(String, nullable=False)
    enviada_por = Column(String, nullable=True)


class HistorialAccion(Base):
    """Bitácora de auditoría y trazabilidad para Acciones de Mejora."""

    __tablename__ = "historial_acciones"

    id = Column(Integer, primary_key=True, index=True)
    accion_id = Column(Integer, ForeignKey("acciones_mejora.id"), nullable=False)
    fecha = Column(String, nullable=False)
    evento = Column(String, nullable=False)


class Solicitud(Base):
    """Módulo de envío directo de requerimientos vía correo a otras áreas."""

    __tablename__ = "solicitudes"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String, nullable=False)
    estado = Column(String, nullable=False, default="Pendiente")  # "Pendiente" | "Respondida"

    asunto = Column(Text, nullable=False)
    instrucciones = Column(Text, nullable=True)
    destinatario_nombre = Column(String, nullable=True)
    destinatario_correo = Column(String, nullable=True)
    fecha_envio = Column(String, nullable=False)
    plazo_respuesta = Column(String, nullable=True)
    ultima_notificacion_vencimiento = Column(String, nullable=True)

    # Respuestas de la persona destinataria (Etapa 2)
    informe_investigacion = Column(Text, nullable=True)
    analisis_causa_raiz = Column(Text, nullable=True)
    correccion_inmediata = Column(Text, nullable=True)
    plan_accion = Column(Text, nullable=True)
    evidencia = Column(Text, nullable=True)
    responsables = Column(String, nullable=True)
    plazo_ejecucion = Column(String, nullable=True)
    fecha_respuesta = Column(String, nullable=True)

    historial = relationship("HistorialSolicitud", backref="solicitud", cascade="all, delete-orphan")


class HistorialSolicitud(Base):
    """Bitácora de auditoría de Solicitudes."""

    __tablename__ = "historial_solicitudes"

    id = Column(Integer, primary_key=True, index=True)
    solicitud_id = Column(Integer, ForeignKey("solicitudes.id"), nullable=False)
    fecha = Column(String, nullable=False)
    evento = Column(String, nullable=False)


class Usuario(Base):
    """Usuarios del sistema: la ingeniera (admin) y los Directores de Carrera (usuario)."""

    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre_completo = Column(String, nullable=False)
    correo = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    rol = Column(String, nullable=False, default="usuario")  # "admin" | "usuario"
    sede = Column(String, nullable=True)  # None para admin (ve todas las sedes)
    area = Column(String, nullable=True)  # Área/carrera del Director (ej. "ODO"); se usa para asignarle acciones
    activo = Column(Boolean, nullable=False, default=True)

    # Áreas del Director/a (puede tener varias). La columna "area" de arriba queda como
    # texto de apoyo: se mantiene igual a las áreas unidas con " / ".
    areas_rel = relationship("Area", secondary=usuario_areas, lazy="selectin")

    @property
    def areas(self):
        return sorted(a.nombre for a in self.areas_rel)


# --- Utilidades de áreas ---

def norm_area(valor):
    return (valor or "").strip().lower()


def parse_areas(texto):
    """'ODO / DAF', 'ODO; DAF' o 'ODO, DAF' -> ['ODO', 'DAF'] (sin repetidos)."""
    if not texto:
        return []
    vistos, salida = set(), []
    for parte in re.split(r"\s*[;,]\s*|\s+/\s+", str(texto)):
        nombre = parte.strip()
        if nombre and norm_area(nombre) not in vistos:
            vistos.add(norm_area(nombre))
            salida.append(nombre)
    return salida


def obtener_o_crear_area(db, nombre):
    """Busca el área por nombre (sin importar mayúsculas/espacios); si no existe, la crea."""
    nombre = (nombre or "").strip()
    if not nombre:
        return None
    area = db.query(Area).filter(func.lower(func.trim(Area.nombre)) == norm_area(nombre)).first()
    if not area:
        area = Area(nombre=nombre, activa=True)
        db.add(area)
        db.flush()
    return area


def asignar_areas(db, objeto, nombres):
    """Deja al usuario o a la acción con exactamente esas áreas y sincroniza su texto de apoyo."""
    areas, ids = [], set()
    for n in nombres or []:
        a = obtener_o_crear_area(db, n)
        if a and a.id not in ids:
            ids.add(a.id)
            areas.append(a)
    objeto.areas_rel = areas
    texto = " / ".join(sorted(a.nombre for a in areas)) or None
    if isinstance(objeto, Usuario):
        objeto.area = texto
    else:
        objeto.area_responsable = texto
    return areas


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()