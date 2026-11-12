"""Validación básica de archivos antes de procesarlos o almacenarlos."""
from io import BytesIO
import re
from zipfile import ZipFile


def validar_zip_oficina(archivo, entrada):
    entradas = archivo.infolist()
    if len(entradas) > 2000 or sum(i.file_size for i in entradas) > 50 * 1024 * 1024:
        raise ValueError("El documento es demasiado grande al descomprimirlo.")
    if any("vbaproject" in i.filename.lower() for i in entradas):
        raise ValueError("No se admiten documentos con macros.")
    archivo.getinfo(entrada)


def validar_xml(datos):
    # Elimina los bytes nulos de las representaciones UTF-16 y UTF-32 antes de buscar DTD.
    xml = datos.replace(b"\0", b"").upper()
    if b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:
        raise ValueError("El documento contiene declaraciones XML no permitidas.")


def nombre_archivo_seguro(nombre):
    nombre = (nombre or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not nombre or len(nombre) > 240 or re.search(r"[\x00-\x1f\x7f]", nombre):
        raise ValueError("El nombre del archivo es inválido o demasiado largo.")
    return nombre


def validar_evidencia(contenido, extension):
    if extension in {".docx", ".xlsx"}:
        entrada = "word/document.xml" if extension == ".docx" else "xl/workbook.xml"
        with ZipFile(BytesIO(contenido)) as archivo:
            validar_zip_oficina(archivo, entrada)
        return
    if extension == ".csv":
        codificacion = "utf-16" if contenido.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
        try:
            texto = contenido.decode(codificacion)
        except UnicodeDecodeError:
            texto = contenido.decode("cp1252")
        if texto.strip() and not re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", texto):
            return
    elif extension == ".webp":
        if contenido.startswith(b"RIFF") and contenido[8:12] == b"WEBP":
            return
    else:
        prefijos = {
            ".pdf": b"%PDF-", ".jpg": b"\xff\xd8\xff", ".jpeg": b"\xff\xd8\xff",
            ".png": b"\x89PNG\r\n\x1a\n",
            ".xls": b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",
            ".doc": b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",
        }
        if contenido.startswith(prefijos[extension]):
            return
    raise ValueError("El contenido del archivo no corresponde a su extensión.")
