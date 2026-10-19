"""
Migración para: áreas múltiples, plan de acción en lista y nuevos estados.

Ejecutar UNA vez, desde la carpeta backend/ (con el servidor detenido):

    python migrar_areas.py --simular     # muestra qué haría, sin guardar nada
    python migrar_areas.py               # aplica los cambios
    python migrar_areas.py --renumerar   # además, cambia AM BS-14-26 -> AM BS-EA-14-26

Qué hace:
  1. Crea las tablas nuevas (áreas, usuario_areas, accion_areas, plan_accion_items).
  2. Pasa el "área" de cada usuario y de cada acción al nuevo catálogo de áreas.
  3. Convierte el plan de acción en texto de cada acción en una acción del nuevo plan (con su evidencia).
  4. Las acciones llenadas en el sistema que estaban "Pendiente Verificación" pasan a
     "En ejecución" (si el plazo de ejecución aún no se cumple) o "Pendiente de evidencia".
     Las acciones importadas desde Excel no se tocan.
  5. (Solo con --renumerar) agrega el código de sede al número: AM BS-14-26 -> AM BS-EA-14-26.
"""
import re
import sys
from datetime import date

from database import (
    SessionLocal, Base, engine, Usuario, AccionMejora, PlanAccionItem,
    asignar_areas, parse_areas,
)

SEDES = {"El Alto": "EA", "Cochabamba": "CB", "Santa Cruz": "SC", "La Paz": "LP", "Nacional": "NA"}
PATRON_VIEJO = re.compile(r"^AM\s*([A-Z]+)-(\d+)-(\d{2})$", re.IGNORECASE)

simular = "--simular" in sys.argv
renumerar = "--renumerar" in sys.argv

Base.metadata.create_all(bind=engine)
db = SessionLocal()
resumen = {"usuarios": 0, "acciones_con_area": 0, "planes": 0, "estados": 0, "numeros": 0, "numeros_omitidos": 0}

# 2a) Áreas de los usuarios
for u in db.query(Usuario).filter(Usuario.rol == "usuario").all():
    if not u.areas_rel and (u.area or "").strip():
        asignar_areas(db, u, parse_areas(u.area))
        resumen["usuarios"] += 1

acciones = db.query(AccionMejora).all()

# 2b) Áreas de las acciones
for a in acciones:
    if not a.areas_rel and (a.area_responsable or "").strip():
        asignar_areas(db, a, parse_areas(a.area_responsable))
        resumen["acciones_con_area"] += 1

# 3) Plan de acción en lista
for a in acciones:
    if not a.plan_items and (a.plan_accion or "").strip():
        a.plan_items = [
            PlanAccionItem(orden=0, accion_texto=a.plan_accion.strip(), evidencia=(a.evidencia_parte1 or "").strip() or None)
        ]
        resumen["planes"] += 1

# 4) Estados nuevos (solo acciones cuyo plan se llenó en el sistema)
hoy = date.today()
for a in acciones:
    if a.estado == "Pendiente Verificación" and a.fecha_llenado_parte1:
        try:
            futuro = date.fromisoformat(a.plazo_ejecucion or "") > hoy
        except ValueError:
            futuro = False
        nuevo = "En ejecución" if futuro else ("Pendiente Verificación" if a.evidencias else "Pendiente de evidencia")
        if nuevo != a.estado:
            a.estado = nuevo
            resumen["estados"] += 1

# 5) Código de sede en el número (opcional)
if renumerar:
    existentes = {a.numero for a in acciones}
    for a in acciones:
        m = PATRON_VIEJO.match((a.numero or "").strip())
        if not m:
            continue
        sede = SEDES.get((a.sede or "").strip() or "El Alto", "EA")
        nuevo = f"AM {m.group(1).upper()}-{sede}-{m.group(2)}-{m.group(3)}"
        if nuevo in existentes:
            resumen["numeros_omitidos"] += 1
            continue
        existentes.discard(a.numero)
        existentes.add(nuevo)
        for otra in acciones:
            if otra.numero_accion_derivada == a.numero:
                otra.numero_accion_derivada = nuevo
        a.numero = nuevo
        resumen["numeros"] += 1

if simular:
    db.rollback()
    print("SIMULACIÓN (no se guardó nada):")
else:
    db.commit()
    print("Migración aplicada:")
print(f"  Usuarios con áreas migradas ........ {resumen['usuarios']}")
print(f"  Acciones con áreas migradas ........ {resumen['acciones_con_area']}")
print(f"  Planes convertidos a lista ......... {resumen['planes']}")
print(f"  Estados actualizados ............... {resumen['estados']}")
if renumerar:
    print(f"  Números con código de sede ......... {resumen['numeros']} (omitidos por repetirse: {resumen['numeros_omitidos']})")
db.close()
