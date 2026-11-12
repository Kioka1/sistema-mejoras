"""Completa la plantilla institucional conservando sus partes originales.

No utiliza Office ni necesita nuevas dependencias en el servidor.
"""
from io import BytesIO
from pathlib import Path
import re
import struct
from xml.dom import minidom
from zipfile import ZipFile, ZIP_DEFLATED

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PLANTILLA = Path(__file__).parent / 'templates' / 'accion_mejora.docx'


def datos_imagen(datos):
    """Formato y dimensiones, sin aceptar SVG ni contenido activo."""
    if datos.startswith(b'\x89PNG\r\n\x1a\n') and len(datos) >= 33 and datos[12:16] == b'IHDR':
        ancho, alto = struct.unpack('>II', datos[16:24])
        extension, mime = 'png', 'image/png'
    elif datos.startswith(b'\xff\xd8') and datos.endswith(b'\xff\xd9'):
        pos = 2
        ancho = alto = 0
        while pos + 4 <= len(datos):
            if datos[pos] != 255:
                break
            while pos < len(datos) and datos[pos] == 255:
                pos += 1
            if pos >= len(datos):
                break
            marca = datos[pos]
            pos += 1
            if marca in (0xD8, 0xD9) or 0xD0 <= marca <= 0xD7:
                continue
            if pos + 2 > len(datos):
                break
            longitud = int.from_bytes(datos[pos:pos + 2], 'big')
            if longitud < 2 or pos + longitud > len(datos):
                break
            if marca in (0xC0, 0xC1, 0xC2) and longitud >= 8:
                alto, ancho = struct.unpack('>HH', datos[pos + 3:pos + 7])
                break
            pos += longitud
        extension, mime = 'jpg', 'image/jpeg'
    else:
        raise ValueError('La firma y sello deben ser una imagen PNG o JPG válida.')
    if not 0 < ancho <= 15000 or not 0 < alto <= 15000:
        raise ValueError('La imagen tiene dimensiones inválidas o demasiado grandes.')
    return extension, mime, ancho, alto


def _texto(parrafo, valor):
    doc = parrafo.ownerDocument
    anterior = next(iter(parrafo.getElementsByTagNameNS(W, 'rPr')), None)
    propiedades = anterior.cloneNode(True) if anterior is not None else doc.createElementNS(W, 'w:rPr')
    for etiqueta in ('highlight', 'color'):
        for elemento in list(propiedades.getElementsByTagNameNS(W, etiqueta)):
            elemento.parentNode.removeChild(elemento)
    color = doc.createElementNS(W, 'w:color')
    color.setAttributeNS(W, 'w:val', '000000')
    propiedades.appendChild(color)
    for hijo in list(parrafo.childNodes):
        if not (hijo.nodeType == hijo.ELEMENT_NODE and hijo.namespaceURI == W and hijo.localName == 'pPr'):
            parrafo.removeChild(hijo)
    run = doc.createElementNS(W, 'w:r')
    run.appendChild(propiedades)
    lineas = str(valor or '').splitlines() or ['']
    for i, linea in enumerate(lineas):
        if i:
            run.appendChild(doc.createElementNS(W, 'w:br'))
        nodo = doc.createElementNS(W, 'w:t')
        nodo.setAttribute('xml:space', 'preserve')
        # XML 1.0 no permite los controles de algunas importaciones antiguas.
        nodo.appendChild(doc.createTextNode(re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', linea)))
        run.appendChild(nodo)
    parrafo.appendChild(run)


def generar_formulario(accion, firma_sello=None):
    with ZipFile(PLANTILLA) as entrada:
        partes = {n: entrada.read(n) for n in entrada.namelist()}
    doc = minidom.parseString(partes['word/document.xml'])
    body = doc.getElementsByTagNameNS(W, 'body')[0]
    parrafos = list(body.getElementsByTagNameNS(W, 'p'))
    if len(parrafos) != 38:
        raise ValueError('La plantilla cambió: revisa su mapa de campos antes de exportar.')
    items = accion.plan_items
    plan = '\n'.join(f'{i.orden + 1}. {i.accion_texto}' for i in items) if items else accion.plan_accion
    evidencia_prevista = '\n'.join(f'{i.orden + 1}. {i.evidencia or ""}' for i in items) if items else accion.evidencia_parte1
    archivos = '\n'.join(f'• {ev.nombre_original}' for ev in accion.evidencias)
    revisada = '\n'.join(x for x in (accion.evidencia_parte2, archivos) if x)
    valores = {
        0: f'NÚMERO DE ACCIÓN DE MEJORA:  {accion.numero_ac_original or accion.numero}',
        2: accion.declaracion_hallazgo,
        3: f'Fuente de Identificación: {accion.fuente_identificacion or ""}',
        4: f'Proceso(s): {accion.procesos or ""}',
        9: accion.analisis_causa_raiz,
        12: accion.correccion_inmediata or 'No aplica',
        15: plan,
        16: f'Evidencia:\n{evidencia_prevista or ""}',
        19: accion.fecha_llenado_parte1,
        22: accion.responsables,
        25: accion.plazo_ejecucion,
        28: f'Fecha de Verificación de la Implementación del Plan de Acción: {accion.fecha_verificacion or ""}',
        30: accion.descripcion_verificacion,
        32: revisada,
        35: accion.conclusion,
        36: f'Nombre del Coordinador de Sistemas de Gestión: {accion.coordinador_sistemas_gestion or ""}',
        37: f'N° NUEVA ACCIÓN DE MEJORA: {accion.numero_accion_derivada or "No aplica"}',
    }
    if accion.informe_investigacion:
        valores[6] = f'Informe de Investigación\n{accion.informe_investigacion}'
    for indice, valor in valores.items():
        _texto(parrafos[indice], valor)
    if firma_sello:
        extension, mime, ancho, alto = datos_imagen(firma_sello)
        escala = min(2.4 * 914400 / ancho, 1.2 * 914400 / alto)
        cx, cy = int(ancho * escala), int(alto * escala)
        rels = minidom.parseString(partes['word/_rels/document.xml.rels'])
        usados = {n.getAttribute('Id') for n in rels.documentElement.childNodes if n.nodeType == n.ELEMENT_NODE}
        rid = 'rIdFirmaSello'
        while rid in usados:
            rid += 'X'
        rel = rels.createElementNS(rels.documentElement.namespaceURI, 'Relationship')
        rel.setAttribute('Id', rid)
        rel.setAttribute('Type', R + '/image')
        rel.setAttribute('Target', f'media/firma_sello.{extension}')
        rels.documentElement.appendChild(rel)
        partes['word/_rels/document.xml.rels'] = rels.toxml(encoding='UTF-8')
        tipos = minidom.parseString(partes['[Content_Types].xml'])
        defaults = tipos.getElementsByTagName('Default')
        if not any(n.getAttribute('Extension') == extension for n in defaults):
            nodo = tipos.createElementNS(tipos.documentElement.namespaceURI, 'Default')
            nodo.setAttribute('Extension', extension)
            nodo.setAttribute('ContentType', mime)
            tipos.documentElement.appendChild(nodo)
            partes['[Content_Types].xml'] = tipos.toxml(encoding='UTF-8')
        partes[f'word/media/firma_sello.{extension}'] = firma_sello
        drawing = minidom.parseString(f'''<w:r xmlns:w="{W}" xmlns:r="{R}">
          <w:br/><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="{cx}" cy="{cy}"/><wp:docPr id="9001" name="Firma y sello proporcionados"/>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:nvPicPr><pic:cNvPr id="0" name="Firma y sello"/><pic:cNvPicPr/></pic:nvPicPr>
          <pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
          <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
          </pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>''')
        parrafos[36].appendChild(doc.importNode(drawing.documentElement, True))
    partes['word/document.xml'] = doc.toxml(encoding='UTF-8')
    salida = BytesIO()
    with ZipFile(salida, 'w', ZIP_DEFLATED) as destino:
        for nombre, contenido in partes.items():
            destino.writestr(nombre, contenido)
    salida.seek(0)
    return salida
