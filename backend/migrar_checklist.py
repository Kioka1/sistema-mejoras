"""
Migración: cada archivo de evidencia se liga a una acción del plan (checklist de evidencias).
Agrega la columna evidencias_archivos.plan_item_id.
Ejecutar UNA vez, desde backend/ (con el servidor detenido):  python migrar_checklist.py
Es seguro correrla más de una vez.
"""
from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    conn.execute(text(
        "ALTER TABLE evidencias_archivos "
        "ADD COLUMN IF NOT EXISTS plan_item_id INTEGER REFERENCES plan_accion_items(id) ON DELETE SET NULL"
    ))
    conn.commit()

print("Listo: evidencias_archivos.plan_item_id agregada.")