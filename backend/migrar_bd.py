"""
Migración manual: agrega columnas nuevas (categoría/subcategoría, área de usuario,
observaciones y recordatorio de evidencia). Las tablas nuevas (evidencias_archivos,
recomendaciones) se crean solas al iniciar el servidor.
Desde backend/: python migrar_bd.py
"""
from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE acciones_mejora ADD COLUMN IF NOT EXISTS categoria VARCHAR"))
    conn.execute(text("ALTER TABLE acciones_mejora ADD COLUMN IF NOT EXISTS subcategoria VARCHAR"))
    conn.execute(text("ALTER TABLE acciones_mejora ADD COLUMN IF NOT EXISTS ultima_observacion TEXT"))
    conn.execute(text("ALTER TABLE acciones_mejora ADD COLUMN IF NOT EXISTS ultima_notificacion_evidencia VARCHAR"))
    conn.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS area VARCHAR"))
    conn.commit()

print("Columnas agregadas con éxito.")