"""Nombres comprometidos en el plan y comprobación de los archivos recibidos."""
import re
import unicodedata
from types import SimpleNamespace

EXTENSIONES = {'.pdf', '.xls', '.xlsx', '.csv', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'}


def normalizar_nombre(nombre):
    nombre = (nombre or '').strip().lower()
    base, punto, extension = nombre.rpartition('.')
    if punto and f'.{extension}' in EXTENSIONES:
        nombre = base
    nombre = ''.join(c for c in unicodedata.normalize('NFKD', nombre)
                     if not unicodedata.combining(c))
    return re.sub(r'[\s_]+', '', nombre)


def nombres_esperados(texto):
    return [linea.strip() for linea in (texto or '').splitlines() if linea.strip()]


def validar_nombres(texto):
    nombres = nombres_esperados(texto)
    if not nombres:
        raise ValueError('Indica al menos un nombre de archivo por acción del plan.')
    vistos = set()
    for nombre in nombres:
        clave = normalizar_nombre(nombre)
        if not clave or len(nombre) > 255 or re.search(r'[\\/:*?"<>|\x00-\x1f]', nombre):
            raise ValueError(f'Nombre de archivo inválido: {nombre}. Escribe solo el nombre, sin rutas.')
        if clave in vistos:
            raise ValueError(f'El nombre {nombre} está repetido. Usa nombres distintos para cada evidencia.')
        vistos.add(clave)
    return nombres


def comprobar_archivo(accion, item_id, nombre, excluir_id=None):
    item = next((i for i in accion.plan_items if i.id == item_id), None)
    if not item:
        raise ValueError('Selecciona una acción del plan de esta Acción de Mejora.')
    esperados = nombres_esperados(item.evidencia)
    clave = normalizar_nombre(nombre)
    if not clave or clave not in {normalizar_nombre(n) for n in esperados}:
        raise ValueError(f'El archivo «{nombre}» no coincide. Se esperaba: {"; ".join(esperados)}. '
                         'Corrige su nombre antes de subirlo.')
    if any(ev.id != excluir_id and ev.plan_item_id == item_id
           and normalizar_nombre(ev.nombre_original) == clave for ev in accion.evidencias):
        raise ValueError('Ya hay un archivo para ese nombre. Elimina el anterior si necesitas reemplazarlo.')


def checklist(accion):
    if not accion.plan_items:
        return [], []
    faltan, invalidos = [], []
    ids = {i.id for i in accion.plan_items}
    for item in accion.plan_items:
        esperados = nombres_esperados(item.evidencia)
        recibidos = set()
        claves = {normalizar_nombre(n) for n in esperados}
        for archivo in accion.evidencias:
            if archivo.plan_item_id != item.id:
                continue
            clave = normalizar_nombre(archivo.nombre_original)
            if clave not in claves or clave in recibidos:
                invalidos.append(archivo)
            recibidos.add(clave)
        pendientes = [n for n in esperados if normalizar_nombre(n) not in recibidos]
        if pendientes or not esperados:
            faltan.append(SimpleNamespace(orden=item.orden, accion_texto=item.accion_texto,
                                         evidencia='; '.join(pendientes) or 'nombres no definidos'))
    invalidos.extend(ev for ev in accion.evidencias if ev.plan_item_id not in ids)
    return faltan, invalidos
