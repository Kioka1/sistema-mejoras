"""
Configuración de la base de datos — PostgreSQL.
Sistematización de Acciones de Mejora (CAPA) y Solicitudes.
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import os

# --- Configuración de PostgreSQL ---
PG_USER = os.environ.get("DB_USER", "postgres")
PG_PASSWORD = os.environ.get("DB_PASSWORD", "TU_CONTRASEÑA_AQUI")
PG_HOST = os.environ.get("DB_HOST", "localhost")
PG_PORT = os.environ.get("DB_PORT", "5432")
PG_NAME = os.environ.get("DB_NAME", "sistema_mejoras")

DATABASE_URL = f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


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
    activo = Column(Boolean, nullable=False, default=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()