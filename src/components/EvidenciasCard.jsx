import { useState } from "react";
import { subirEvidencia, asignarEvidencia, eliminarEvidencia, enviarEvidencia, urlDescargarEvidencia } from "../api.js";
import { nombresEsperados, nombreCoincide, normalizarNombre } from "../evidencias.js";

export default function EvidenciasCard({ accion, rol, onCambio }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const esAdmin = rol === "Sistemas de Gestión (calidad)";
  const cerrada = accion.estado === "Cerrada";
  const esperando = accion.estado === "Pendiente de evidencia";
  const puedeEditar = !cerrada && (esAdmin || esperando);
  const items = accion.plan_items || [];
  const archivos = accion.evidencias || [];
  const slots = items.flatMap((item) => nombresEsperados(item.evidencia).map((nombre) => ({ item, nombre,
    archivos: archivos.filter((ev) => ev.plan_item_id === item.id && nombreCoincide(ev.nombre_original, nombre)),
  })));
  const problemáticos = archivos.filter((ev) => !slots.some((s) => s.item.id === ev.plan_item_id && nombreCoincide(ev.nombre_original, s.nombre)));
  const repetidos = slots.filter((s) => s.archivos.length > 1);
  const faltantes = slots.filter((s) => s.archivos.length === 0);
  const completo = items.length ? slots.length > 0 && items.every((i) => nombresEsperados(i.evidencia).length > 0)
    && !faltantes.length && !problemáticos.length && !repetidos.length : archivos.length > 0;
  const ejecutar = async (operacion) => {
    setOcupado(true); setError("");
    try { await operacion(); }
    catch (err) { setError(err.message || "No se pudo completar la operación."); }
    finally { setOcupado(false); onCambio(); }
  };
  const subir = (itemId, nombre) => (e) => {
    const archivo = e.target.files?.[0]; e.target.value = "";
    if (!archivo) return;
    if (nombre && !nombreCoincide(archivo.name, nombre)) {
      setError(`El archivo «${archivo.name}» no coincide. El nombre esperado es «${nombre}». Corrige su nombre antes de subirlo.`);
      return;
    }
    ejecutar(() => subirEvidencia(accion.id, archivo, itemId));
  };
  const fila = (ev) => (
    <div key={ev.id} style={{ margin: "8px 0", fontSize: 13 }}>
      <a href={urlDescargarEvidencia(ev.id)} target="_blank" rel="noreferrer">{ev.nombre_original}</a>
      <span> · {ev.fecha}</span>
      {puedeEditar && <button type="button" className="back-link" disabled={ocupado} style={{ marginLeft: 12 }}
        onClick={() => { if (window.confirm("¿Eliminar este archivo?")) ejecutar(() => eliminarEvidencia(ev.id)); }}>Eliminar</button>}
    </div>
  );
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p className="stage-title" style={{ marginTop: 0 }}>Evidencias del plan</p>
      <p style={{ fontSize: 13 }}>Plazo de ejecución: {accion.plazo_ejecucion || "—"}</p>
      <p style={{ fontSize: 13 }}><b>Fecha límite para enviar evidencias:</b> {accion.plazo_evidencias || "—"} (2 días hábiles después de la ejecución).</p>
      {items.length > 0 && <p style={{ fontSize: 13 }}>
        {slots.filter((s) => s.archivos.length === 1).length} de {slots.length} archivos esperados recibidos.
        {problemáticos.length > 0 && ` Hay ${problemáticos.length} archivo(s) sin asignar o con un nombre diferente.`}
        {repetidos.length > 0 && " Hay archivos repetidos; conserva solo uno por casillero."}
      </p>}
      {items.map((item) => <div key={item.id} style={{ borderTop: "1px solid var(--border-soft)", padding: "12px 0" }}>
        <b>{item.orden + 1}. {item.accion_texto}</b>
        {slots.filter((s) => s.item.id === item.id).map((slot) => (
          <div key={normalizarNombre(slot.nombre)} style={{ marginTop: 12, paddingLeft: 12 }}>
            <div style={{ fontSize: 13 }}><b>{slot.archivos.length ? "✓" : "Pendiente:"}</b> {slot.nombre}</div>
            {slot.archivos.map(fila)}
            {puedeEditar && slot.archivos.length === 0 && <input type="file" aria-label={`Subir ${slot.nombre}`}
              accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.jpeg,.png,.webp" disabled={ocupado} onChange={subir(item.id, slot.nombre)} />}
          </div>
        ))}
        {!nombresEsperados(item.evidencia).length && <p>Este plan no tiene nombres de evidencia definidos. Solicita su corrección.</p>}
      </div>)}
      {problemáticos.length > 0 && <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 12 }}>
        <b>Archivos por corregir o asignar</b>
        {problemáticos.map((ev) => <div key={ev.id}>
          {fila(ev)}
          {puedeEditar && <select aria-label={`Asignar ${ev.nombre_original}`} disabled={ocupado} value=""
            onChange={(e) => { if (e.target.value) ejecutar(() => asignarEvidencia(ev.id, Number(e.target.value))); }}>
            <option value="">Asignar al plan...</option>
            {items.filter((i) => nombresEsperados(i.evidencia).some((n) => nombreCoincide(ev.nombre_original, n))).map((i) =>
              <option key={i.id} value={i.id}>{i.orden + 1}. {i.accion_texto}</option>)}
          </select>}
        </div>)}
      </div>}
      {!items.length && <>{archivos.map(fila)}{puedeEditar && <input type="file" disabled={ocupado}
        accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={subir(null, null)} />}</>}
      {puedeEditar && <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        Máximo 15 MB por archivo. El nombre debe coincidir; se ignoran mayúsculas, acentos, extensión, espacios y guiones bajos.
      </p>}
      {!esAdmin && esperando && <button type="button" className="btn-primary" disabled={ocupado || !completo}
        onClick={() => { if (window.confirm("¿Enviar las evidencias a Sistemas de Gestión?")) ejecutar(() => enviarEvidencia(accion.id)); }}>
        {ocupado ? "Procesando..." : "Enviar evidencias a Sistemas de Gestión"}
      </button>}
      {!esAdmin && accion.estado === "En ejecución" && <p>Podrás subir los archivos al llegar el plazo de ejecución.</p>}
      {ocupado && <p>Procesando archivo...</p>}
      {error && <p role="alert" style={{ color: "var(--danger-text)", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
