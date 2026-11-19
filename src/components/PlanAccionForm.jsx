import CampoGuiado, { GuiaRoles, SeccionGuiada } from "./CampoGuiado.jsx";
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
      <GuiaRoles />
      <SeccionGuiada rol="area">Primera parte — Completa el usuario del Área Responsable</SeccionGuiada>
      <label className="field-label">Informe de investigación</label>
      <CampoGuiado rol="area" etiqueta="Informe de investigación"><textarea className="text-input" rows={3} value={form.informe_investigacion} onChange={set("informe_investigacion")} /></CampoGuiado>
      <label className="field-label">Análisis de causa raíz *</label>
      <CampoGuiado rol="area" etiqueta="Análisis de causa raíz *" guia="X Completar este campo · Puede utilizar diagrama de pescado, los 5 porqués, 5 W + 2 H u otra herramienta de análisis."><textarea required className="text-input" rows={3} value={form.analisis_causa_raiz} onChange={set("analisis_causa_raiz")} /></CampoGuiado>
      <label className="field-label">Corrección inmediata (si aplica)</label>
      <CampoGuiado rol="area" etiqueta="Corrección inmediata (si aplica)" guia="X completar solo si requiere una acción inmediata de corrección · ¿Cómo solucionamos el problema de forma inmediata?"><textarea className="text-input" rows={2} value={form.correccion_inmediata} onChange={set("correccion_inmediata")} /></CampoGuiado>
      {form.acciones.map((item, i) => (
        <div key={i} style={{ borderTop: "1px solid var(--border-soft)", marginTop: 16, paddingTop: 12 }}>
          <label className="field-label">Acción {i + 1} del plan *</label>
          <CampoGuiado rol="area" etiqueta={`Acción ${i + 1} del plan`} guia="X Completar 1 o más acciones · ¿Cómo eliminamos la causa raíz? ¿Cómo aseguramos que el problema no se repita?">
            <textarea required className="text-input" rows={3} value={item.accion}
              onChange={(e) => editarItem(i, "accion", e.target.value)} />
          </CampoGuiado>
          <label className="field-label">Nombres de archivos de evidencia esperados *</label>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px" }}>
            Un nombre por línea, sin rutas. Ejemplo: Informe de capacitación.pdf. Cada nombre tendrá su propio casillero.
          </p>
          <CampoGuiado rol="area" etiqueta={`Evidencia de la acción ${i + 1}`} guia="X Indicar la evidencia que presentará por cada acción propuesta: informe, formulario, imágenes, etc. Escriba un nombre de archivo por línea.">
          <textarea required className="text-input" rows={3} value={item.evidencia}
            placeholder={"Informe de capacitación.pdf\nLista de asistencia.pdf"}
            onChange={(e) => editarItem(i, "evidencia", e.target.value)} />
          </CampoGuiado>
          {form.acciones.length > 1 && <button type="button" className="back-link" disabled={enviando}
            onClick={() => setForm((f) => ({ ...f, acciones: f.acciones.filter((_, n) => n !== i) }))}>Quitar acción {i + 1}</button>}
        </div>
      ))}
      <button type="button" className="back-link" style={{ margin: "12px 0" }} disabled={enviando}
        onClick={() => setForm((f) => ({ ...f, acciones: [...f.acciones, { accion: "", evidencia: "" }] }))}>+ Agregar acción al plan</button>
      <div className="grid-2">
        <div><label className="field-label">Responsable(s) *</label>
          <CampoGuiado rol="area" etiqueta="Responsable(s) *" guia="X nombre del responsable a cargo de seguimiento y/o ejecución"><input required className="text-input" value={form.responsables} onChange={set("responsables")} /></CampoGuiado></div>
        <div><label className="field-label">Plazo de ejecución *</label>
          <CampoGuiado rol="area" etiqueta="Plazo de ejecución *" guia="X completar el plazo para la ejecución del plan"><input required className="text-input" type="date" min={fechaMinima} value={form.plazo_ejecucion} onChange={set("plazo_ejecucion")} /></CampoGuiado></div>
      </div>
      <button className="btn-primary" style={{ marginTop: 16 }} disabled={enviando}>
        {enviando ? "Enviando..." : accion.estado === "Observada" ? "Enviar plan corregido" : "Enviar formulario"}
      </button>
      {error && <p role="alert" style={{ color: "var(--danger-text)", fontSize: 13 }}>{error}</p>}
    </form>
  );
}
