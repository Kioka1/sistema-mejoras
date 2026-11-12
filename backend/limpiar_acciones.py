"""Limpieza puntual de acciones, con respaldo previo y transacción.

Desde backend/: python limpiar_acciones.py (solo muestra cantidades).
Para aplicar: python limpiar_acciones.py --aplicar
No elimina usuarios, áreas, solicitudes, recomendaciones ni archivos originales.
Con --solo-catalogos también limpia solicitudes, recomendaciones y registros;
conserva usuarios, áreas y la relación usuario_areas.
"""
import argparse
from datetime import datetime, timezone, timedelta
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

from sqlalchemy import MetaData, Table, inspect, select, func, text, true
from database import engine

ORDEN = ('notificaciones', 'formularios_historicos', 'evidencias_archivos', 'historial_acciones',
         'accion_areas', 'plan_accion_items', 'acciones_mejora')
ORDEN_OPERATIVOS = ORDEN + ('historial_solicitudes', 'solicitudes', 'recomendaciones', 'registros')
DIRECTORIO = Path(__file__).resolve().parent


def limpiar(conexion_motor, aplicar=False, respaldos=None, solo_catalogos=False):
    with conexion_motor.begin() as conn:
        inspector = inspect(conn)
        existentes = set(inspector.get_table_names())
        if 'acciones_mejora' not in existentes:
            raise RuntimeError('La base no contiene la tabla acciones_mejora.')
        orden = ORDEN_OPERATIVOS if solo_catalogos else ORDEN
        if solo_catalogos:
            conservadas = {'usuarios', 'areas', 'usuario_areas', 'sesiones_usuarios', 'identidades_google', 'desafios_google'}
            desconocidas = existentes - set(orden) - conservadas
            if desconocidas:
                raise RuntimeError(f'Tablas no contempladas: {sorted(desconocidas)}. No se borró nada.')
        nombres = [n for n in orden if n in existentes]
        # Ante nuevas dependencias, detenerse en lugar de borrar en cascada.
        for nombre in existentes:
            for fk in inspector.get_foreign_keys(nombre):
                if fk.get('referred_table') in {'acciones_mejora', 'plan_accion_items'} and nombre not in nombres:
                    raise RuntimeError(f'Hay una dependencia no contemplada: {nombre}. No se borró nada.')
        if aplicar and conexion_motor.dialect.name == 'postgresql':
            conn.execute(text("SET LOCAL lock_timeout = '5s'"))
            tablas = ', '.join('"' + n + '"' for n in nombres)
            conn.execute(text(f'LOCK TABLE {tablas} IN SHARE ROW EXCLUSIVE MODE'))
        metadata = MetaData()
        tablas = {n: Table(n, metadata, autoload_with=conn) for n in nombres}
        ids = list(conn.execute(select(tablas['acciones_mejora'].c.id)).scalars())
        filtros = {n: (true() if solo_catalogos else
                      t.c.id.in_(ids) if n == 'acciones_mejora' else t.c.accion_id.in_(ids))
                   for n, t in tablas.items()}
        filas = {n: [dict(r) for r in conn.execute(select(t).where(filtros[n])).mappings()]
                 for n, t in tablas.items()}
        cantidades = {n: len(rows) for n, rows in filas.items()}
        conservadas = {}
        for nombre in sorted(existentes - set(nombres)):
            tabla = Table(nombre, MetaData(), autoload_with=conn)
            conservadas[nombre] = conn.execute(select(func.count()).select_from(tabla)).scalar_one()
        print('Registros a limpiar:', json.dumps(cantidades, ensure_ascii=False))
        print('Tablas conservadas:', json.dumps(conservadas, ensure_ascii=False))
        if not aplicar or not any(cantidades.values()):
            print('Sin cambios.' if not aplicar else 'No hay registros que limpiar.')
            return None
        destino = Path(respaldos or DIRECTORIO / 'uploads' / 'respaldos').resolve()
        destino.mkdir(parents=True, exist_ok=True)
        fecha = datetime.now(timezone(timedelta(hours=-4)))
        prefijo = 'operativos' if solo_catalogos else 'acciones'
        archivo = destino / f'{prefijo}-{fecha:%Y%m%d-%H%M%S-%f}.zip'
        adjuntos, ausentes = {}, []
        for tabla_archivos, carpeta in (('evidencias_archivos', 'evidencias'), ('formularios_historicos', 'formularios_historicos')):
            raiz = (DIRECTORIO / 'uploads' / carpeta).resolve()
            for fila in filas.get(tabla_archivos, []):
                nombre = fila['nombre_guardado']
                ruta = (raiz / nombre).resolve()
                if ruta.parent != raiz:
                    raise RuntimeError('Una ruta de archivo sale del directorio esperado. No se borró nada.')
                if ruta.is_file():
                    adjuntos[carpeta + '/' + ruta.name] = ruta.read_bytes()
                else:
                    ausentes.append(carpeta + '/' + nombre)
        manifiesto = {
            'version': 1, 'fecha': fecha.isoformat(),
            'modo': 'solo_catalogos' if solo_catalogos else 'acciones',
            'motor': conexion_motor.dialect.name, 'base': conexion_motor.url.database,
            'filas': filas, 'cantidades': cantidades, 'conservadas': conservadas,
            'archivos_ausentes': ausentes,
            'archivos_sha256': {n: sha256(datos).hexdigest() for n, datos in adjuntos.items()},
            'nota': 'IDs originales conservados. Restaurar en orden inverso al borrado. Los archivos originales no se eliminan.',
        }
        contenido = json.dumps(manifiesto, ensure_ascii=False, indent=2).encode('utf-8')
        # Crear el respaldo antes de cualquier DELETE. Nunca sobrescribir otro.
        with ZipFile(archivo, 'x', ZIP_DEFLATED) as zipfile:
            zipfile.writestr('respaldo.json', contenido)
            for nombre, datos in adjuntos.items():
                zipfile.writestr(nombre, datos)
        with ZipFile(archivo) as zipfile:
            if zipfile.testzip() is not None or zipfile.read('respaldo.json') != contenido:
                raise RuntimeError('El respaldo no pasó la verificación. No se borró nada.')
            for nombre, datos in adjuntos.items():
                if sha256(zipfile.read(nombre)).hexdigest() != sha256(datos).hexdigest():
                    raise RuntimeError('Una evidencia no pasó la verificación. No se borró nada.')
        for nombre, tabla in tablas.items():
            eliminados = conn.execute(tabla.delete().where(filtros[nombre])).rowcount
            if eliminados != cantidades[nombre]:
                raise RuntimeError(f'Cambió la cantidad de {nombre}; se revierte la limpieza.')
        for nombre, tabla in tablas.items():
            if conn.execute(select(func.count()).select_from(tabla).where(filtros[nombre])).scalar_one() != 0:
                raise RuntimeError(f'Quedaron registros relacionados en {nombre}; se revierte la limpieza.')
        for nombre, cantidad in conservadas.items():
            tabla = Table(nombre, MetaData(), autoload_with=conn)
            if conn.execute(select(func.count()).select_from(tabla)).scalar_one() != cantidad:
                raise RuntimeError(f'Cambió una tabla que se debía conservar: {nombre}; se revierte la limpieza.')
    # El commit ocurre al salir del bloque, antes de informar el resultado.
    print('Limpieza confirmada. Acciones eliminadas:', len(ids))
    print('Respaldo verificado:', archivo)
    print('Archivos de evidencia respaldados:', len(adjuntos), '/ ya ausentes:', len(ausentes))
    print('Registros eliminados por tabla:', json.dumps(cantidades, ensure_ascii=False))
    print('No se reiniciaron los IDs internos. Tablas indicadas como conservadas sin cambios.')
    return archivo


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--aplicar', action='store_true', help='Respaldar y eliminar todas las acciones y sus registros relacionados.')
    parser.add_argument('--solo-catalogos', action='store_true', help='Conservar únicamente usuarios, áreas y sus asignaciones; respaldar y vaciar todos los datos operativos.')
    args = parser.parse_args()
    limpiar(engine, aplicar=args.aplicar, solo_catalogos=args.solo_catalogos)
