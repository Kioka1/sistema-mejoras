"""Plazos de lunes a viernes, sin calendario de feriados."""
from datetime import date, datetime, timedelta, timezone


def hoy_local():
    return datetime.now(timezone(timedelta(hours=-4))).date()


def sumar_habiles(inicio, dias):
    while dias > 0:
        inicio += timedelta(days=1)
        if inicio.weekday() < 5:
            dias -= 1
    return inicio


def dias_habiles(inicio, fin):
    if fin < inicio:
        return -dias_habiles(fin, inicio)
    dias = 0
    while inicio < fin:
        inicio += timedelta(days=1)
        dias += inicio.weekday() < 5
    return dias


def fecha_evidencias(accion):
    try:
        return sumar_habiles(date.fromisoformat(accion.plazo_ejecucion or ""), 2).isoformat()
    except ValueError:
        return None


def alerta_accion(accion, hoy=None):
    historico = accion.formulario_historico
    if historico and not historico.seguimiento_activo:
        return None
    if accion.estado in ("Pendiente Plan de Acción", "Observada"):
        tipo, fecha = "Formulario", accion.plazo_entrega_plan
    elif accion.estado in ("En ejecución", "Pendiente de evidencia"):
        tipo, fecha = "Evidencias", fecha_evidencias(accion)
    else:
        return None
    try:
        limite = date.fromisoformat(fecha or "")
    except ValueError:
        return None
    hoy = hoy or hoy_local()
    faltan = dias_habiles(hoy, limite)
    nivel = "vencido" if limite < hoy else "proximo" if faltan <= 2 else "pendiente"
    texto = ("Plazo vencido" if nivel == "vencido" else "Vence hoy" if limite == hoy
             else f"Vence el {limite.strftime('%d/%m/%Y')}" if faltan == 0
             else f"Vence en {faltan} día(s) hábil(es)")
    return {"tipo": tipo, "fecha": fecha, "nivel": nivel, "texto": texto}
