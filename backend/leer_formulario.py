"""Lectura de texto de la plantilla institucional. Nunca ejecuta contenido del Word."""
from datetime import datetime
from hashlib import sha256
from io import BytesIO
import re
import unicodedata
from xml.etree import ElementTree as ET
from zipfile import ZipFile, BadZipFile
from seguridad_archivos import validar_zip_oficina, validar_xml

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
MAX_ARCHIVO = 15 * 1024 * 1024


def normalizar(valor):
    return re.sub(r'\s+', ' ', ''.join(c for c in unicodedata.normalize('NFKD', valor or '')
                                     if not unicodedata.combining(c))).strip().lower()


def codigo_normalizado(valor):
    return re.sub(r'\s+', '', valor or '').upper()


def _limpiar(texto):
    lineas = []
    for linea in texto.splitlines():
        n = normalizar(linea)
        if not n or n == 'x' or re.match(r'^x\s+complet', n):
            continue
        if n.startswith(('puede utilizar una herramienta', 'la descripcion del resultado observado')):
            continue
        if n.startswith(('x indicar la evidencia', '¿como ', 'como eliminamos', 'como aseguro')):
            continue
        lineas.append(linea.strip())
    return '\n'.join(lineas)


def _fecha(valor, avisos, campo):
    if not valor:
        return ''
    for formato in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y-%m-%d %H:%M'):
        try:
            return datetime.strptime(valor.strip(), formato).date().isoformat()
        except ValueError:
            pass
    avisos.append(f'Revisa {campo}: no se pudo convertir automáticamente la fecha «{valor}».')
    return valor


def leer_formulario(contenido):
    if len(contenido) > MAX_ARCHIVO:
        raise ValueError('El formulario supera el máximo de 15 MB.')
    try:
        with ZipFile(BytesIO(contenido)) as archivo:
            validar_zip_oficina(archivo, 'word/document.xml')
            entradas = archivo.infolist()
            info = archivo.getinfo('word/document.xml')
            if info.file_size > 8 * 1024 * 1024:
                raise ValueError('El texto del formulario es demasiado grande.')
            xml = archivo.read(info)
            imagenes = any(i.filename.startswith('word/media/') for i in entradas)
    except (BadZipFile, KeyError, RuntimeError, OSError):
        raise ValueError('No se pudo leer el Word. Selecciona un archivo .docx válido, sin contraseña.')
    validar_xml(xml)
    try:
        raiz = ET.fromstring(xml)
    except ET.ParseError:
        raise ValueError('El contenido del Word está dañado.')
    body = raiz.find(W + 'body')
    if body is None:
        raise ValueError('El Word no contiene un cuerpo de documento válido.')
    bloques = []
    for parrafo in body.iter(W + 'p'):
        texto = ''.join((n.text or '') if n.tag == W + 't' else '\n' if n.tag in (W + 'br', W + 'cr')
                        else ' ' if n.tag == W + 'tab' else '' for n in parrafo.iter())
        if texto.strip():
            bloques.append(texto.strip())
    # Etiquetas ordenadas: las específicas deben preceder a «Plan de Acción».
    etiquetas = [
        ('numero de accion de mejora', 'numero_ac_original'),
        ('declaracion del servicio no conforme/oportunidad de mejora', 'declaracion_hallazgo'),
        ('fuente de identificacion', 'fuente_identificacion'),
        ('proceso(s)', 'procesos'), ('procesos:', 'procesos'),
        ('primera parte', None), ('segunda parte', None),
        ('informe de investigacion', 'informe_investigacion'),
        ('analisis de causa', 'analisis_causa_raiz'),
        ('correccion inmediata', 'correccion_inmediata'),
        ('fecha de llenado del formulario', 'fecha_llenado_parte1'),
        ('responsable(s)', 'responsables'), ('responsables:', 'responsables'),
        ('plazo para la ejecucion del plan de accion', 'plazo_ejecucion'),
        ('fecha de verificacion', 'fecha_verificacion'),
        ('descripcion de la verificacion', 'descripcion_verificacion'),
        ('evidencia del plan de accion', 'evidencia_parte2'),
        ('conclusion', 'conclusion'),
        ('nombre del coordinador de sistemas de gestion', 'coordinador_sistemas_gestion'),
        ('n° nueva accion de mejora', 'numero_accion_derivada'),
        ('no nueva accion de mejora', 'numero_accion_derivada'),
        ('verificacion:', None), ('plan de accion', 'plan_accion'),
        ('evidencia:', 'evidencia_parte1'),
    ]
    campos, actual, detectadas = {}, None, set()
    for bloque in bloques:
        n = normalizar(bloque)
        etiqueta = next(((titulo, campo) for titulo, campo in etiquetas if n.startswith(titulo)), None)
        if etiqueta:
            titulo, actual = etiqueta
            detectadas.add(titulo)
            if actual:
                # Respuesta en la misma línea, después de la etiqueta.
                if ':' in bloque:
                    respuesta = bloque.split(':', 1)[1].strip()
                elif '\n' in bloque:
                    respuesta = bloque.split('\n', 1)[1].strip()
                else:
                    respuesta = ''
                respuesta = _limpiar(respuesta)
                if respuesta:
                    campos[actual] = '\n'.join(filter(None, (campos.get(actual), respuesta)))
            continue
        if actual:
            respuesta = _limpiar(bloque)
            if respuesta:
                campos[actual] = '\n'.join(filter(None, (campos.get(actual), respuesta)))
    if 'numero de accion de mejora' not in detectadas or not any('declaracion' in d for d in detectadas):
        raise ValueError('No se reconoció el formato del formulario de Acción de Mejora. Usa el modelo institucional.')
    avisos = ['Confirma el estado real y asigna el área responsable antes de guardar.']
    numero = campos.get('numero_ac_original', '')
    if re.search(r'\bXX\b', numero, re.I):
        campos['numero_ac_original'] = ''
        avisos.append('El número de acción contiene XX de la plantilla; escribe el código real.')
    if not campos.get('declaracion_hallazgo'):
        avisos.append('No se encontró el hallazgo. Completa su descripción en la revisión.')
    for campo in ('fecha_llenado_parte1', 'plazo_ejecucion', 'fecha_verificacion'):
        campos[campo] = _fecha(campos.get(campo, ''), avisos, campo.replace('_', ' '))
    if normalizar(campos.get('numero_accion_derivada', '')) in ('no aplica', 'ninguna', 'n/a'):
        campos['numero_accion_derivada'] = ''
    sede = re.search(r'-(EA|LP|CB|SC|NA)-', numero.upper())
    campos['sede'] = {'EA': 'El Alto', 'LP': 'La Paz', 'CB': 'Cochabamba', 'SC': 'Santa Cruz', 'NA': 'Nacional'}.get(sede.group(1), '') if sede else ''
    if campos.get('conclusion') and campos.get('descripcion_verificacion'):
        sugerido = 'Cerrada'
    elif campos.get('plan_accion'):
        sugerido = 'Pendiente de evidencia'
    else:
        sugerido = 'Pendiente Plan de Acción'
    if imagenes:
        avisos.append('Las imágenes permanecen en el Word original; no se interpretan como evidencias del plan.')
    return {'datos': campos, 'estado_sugerido': sugerido, 'advertencias': avisos,
            'hash_archivo': sha256(contenido).hexdigest()}
