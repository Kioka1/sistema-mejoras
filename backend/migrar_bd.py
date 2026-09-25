"""
Migración manual: agrega las columnas de Categoría y Subcategoría
a la tabla de Acciones de Mejora.
Desde backend/: python migrar_bd.py
"""
from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE acciones_mejora ADD COLUMN IF NOT EXISTS categoria VARCHAR"))
    conn.execute(text("ALTER TABLE acciones_mejora ADD COLUMN IF NOT EXISTS subcategoria VARCHAR"))
    conn.commit()

print("Columnas agregadas con éxito.")