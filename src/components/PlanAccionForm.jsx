import { useState } from "react";
import { completarPlanAccion } from "../api.js";

export default function PlanAccionForm({ accion, onCompletado }) {
  const [form, setForm] = useState({
    informe_investigacion: accion.informe_investigacion || "",
    analisis_causa_raiz: accion.analisis_causa_raiz || "",
    correccion_inmediata: accion.correccion_inmediata || "",
    responsables: accion.responsables || "",
    plazo_ejecucion: accion.plazo_ejecucion || "",
    acciones: accion.plan_items?.length
      ? accion.plan_items.map((i) => ({ accion: i.accion_texto, evidencia: i.evidencia || "" }))
      : [{ accion: accion.plan_accion || "", evidencia: accion.evidencia_parte1 || "" }],
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const editarItem = (indice, campo, valor) => setForm((f) => ({ ...f,
    acciones: f.acciones.map((item, i) => i === indice ? { ...item, [campo]: valor } : item),
  }));
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError("");
    try {
      await completarPlanAccion(accion.id, form);
      onCompletado();
    } catch (err) {
      setError(err.message || "No se pudo guardar el plan.");
    } finally {
      setEnviando(false);
    }
  };
  const hoy = new Date();
  const fechaMinima = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={enviar}>
      <p className="stage-title" style={{ marginTop: 0 }}>Primera Parte — Área Responsable</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Completa el plan y los nombres de las evidencias que presentarás al llegar el plazo de ejecución.
        La fecha de llenado se registra al enviar el formulario.
      </p>
      <label className="field-label">Informe de investigación</label>
      <textarea className="text-input" rows={3} value={form.informe_investigacion} onChange={set("informe_investigacion")} />
      <label className="field-label">Análisis de causa raíz *</label>
      <textarea required className="text-input" rows={3} value={form.analisis_causa_raiz} onChange={set("analisis_causa_raiz")} />
      <label className="field-label">Corrección inmediata (si aplica)</label>
      <textarea className="text-input" rows={2} value={form.correccion_inmediata} onChange={set("correccion_inmediata")} />
      {form.acciones.map((item, i) => (
        <div key={i} style={{ borderTop: "1px solid var(--border-soft)", marginTop: 16, paddingTop: 12 }}>
          <label className="field-label">Acción {i + 1} del plan *</label>
          <textarea required className="text-input" rows={3} value={item.accion}
            onChange={(e) => editarItem(i, "accion", e.target.value)} />
          <label className="field-label">Nombres de archivos de evidencia esperados *</label>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
            Un nombre por línea, sin rutas. Ejemplo: Informe de capacitación.pdf. Cada nombre tendrá su propio casillero.
          </p>
          <textarea required className="text-input" rows={3} value={item.evidencia}
            placeholder={"Informe de capacitación.pdf\nLista de asistencia.pdf"}
            onChange={(e) => editarItem(i, "evidencia", e.target.value)} />
          {form.acciones.length > 1 && <button type="button" className="back-link" disabled={enviando}
            onClick={() => setForm((f) => ({ ...f, acciones: f.acciones.filter((_, n) => n !== i) }))}>Quitar acción {i + 1}</button>}
        </div>
      ))}
      <button type="button" className="back-link" style={{ margin: "12px 0" }} disabled={enviando}
        onClick={() => setForm((f) => ({ ...f, acciones: [...f.acciones, { accion: "", evidencia: "" }] }))}>+ Agregar acción al plan</button>
      <div className="grid-2">
        <div><label className="field-label">Responsable(s) *</label>
          <input required className="text-input" value={form.responsables} onChange={set("responsables")} /></div>
        <div><label className="field-label">Plazo de ejecución *</label>
          <input required className="text-input" type="date" min={fechaMinima} value={form.plazo_ejecucion} onChange={set("plazo_ejecucion")} /></div>
      </div>
      <button className="btn-primary" style={{ marginTop: 16 }} disabled={enviando}>
        {enviando ? "Enviando..." : accion.estado === "Observada" ? "Enviar plan corregido" : "Enviar formulario"}
      </button>
      {error && <p role="alert" style={{ color: "var(--danger-text)", fontSize: 13 }}>{error}</p>}
    </form>
  );
}
