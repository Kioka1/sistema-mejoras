import { useState } from "react";
import { crearAccion } from "../api.js";

const ORIGENES = [
  { value: "BS", label: "BS — Buzón de Sugerencias" },
  { value: "ESE", label: "ESE — Encuesta de Satisfacción Estudiantil" },
  { value: "OD", label: "OD — Operación Diaria" },
  { value: "AI", label: "AI — Auditoría Interna" },
];

const ESTADOS = ["Pendiente Plan de Acción", "Pendiente Verificación", "Cerrada"];

const FORM_VACIO = {
  fuente_identificacion: "BS",
  numero_ac_original: "",
  declaracion_hallazgo: "",
  plan_accion: "",
  categoria: "",
  subcategoria: "",
  area_responsable: "",
  requiere_cambio_sgc: "No",
  plazo_ejecucion: "",
  fecha_cierre_plan: "",
  estado: "Pendiente Plan de Acción",
  observacion: "",
  sede: "El Alto",
};

export default function RegistrarView() {
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [enviando, setEnviando] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const enviar = async () => {
    if (!form.declaracion_hallazgo.trim()) {
      setError("La descripción es obligatoria");
      return;
    }
    setEnviando(true);
    setError("");
    setExito("");
    try {
      const creada = await crearAccion(form);
      setExito(`Acción de Mejora ${creada.numero} registrada con éxito.`);
      setForm(FORM_VACIO);
    } catch (e) {
      setError(e.message || "No se pudo registrar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="stage-section active-stage">
      <p className="stage-title" style={{ marginTop: 0 }}>Registrar Acción de Mejora</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 16, maxWidth: 640 }}>
        Los mismos campos que llenás en el Excel — se guarda directo como una Acción de Mejora.
      </p>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div>
          <label className="field-label">Origen</label>
          <select className="text-input" value={form.fuente_identificacion} onChange={set("fuente_identificacion")}>
            {ORIGENES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">N° de AC (opcional, ej. AM BS-EA-01-25)</label>
          <input
            className="text-input"
            value={form.numero_ac_original}
            onChange={set("numero_ac_original")}
            placeholder="Se genera automático si lo dejas vacío"
          />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Descripción</label>
        <textarea className="text-input" rows={3} value={form.declaracion_hallazgo} onChange={set("declaracion_hallazgo")} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Plan de Acción</label>
        <textarea className="text-input" rows={3} value={form.plan_accion} onChange={set("plan_accion")} />
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div>
          <label className="field-label">Categoría</label>
          <input className="text-input" value={form.categoria} onChange={set("categoria")} />
        </div>
        <div>
          <label className="field-label">Subcategoría</label>
          <input className="text-input" value={form.subcategoria} onChange={set("subcategoria")} />
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div>
          <label className="field-label">Área Responsable</label>
          <input className="text-input" value={form.area_responsable} onChange={set("area_responsable")} />
        </div>
        <div>
          <label className="field-label">¿Se requiere un cambio en el SGC?</label>
          <select className="text-input" value={form.requiere_cambio_sgc} onChange={set("requiere_cambio_sgc")}>
            <option value="No">No</option>
            <option value="Sí">Sí</option>
          </select>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div>
          <label className="field-label">Plazo del Plan de Acción</label>
          <input className="text-input" type="date" value={form.plazo_ejecucion} onChange={set("plazo_ejecucion")} />
        </div>
        <div>
          <label className="field-label">Fecha de Cierre Plan de Acción</label>
          <input className="text-input" type="date" value={form.fecha_cierre_plan} onChange={set("fecha_cierre_plan")} />
        </div>
      </div>

      <div style={{ marginBottom: 12, maxWidth: 320 }}>
        <label className="field-label">Estado</label>
        <select className="text-input" value={form.estado} onChange={set("estado")}>
          {ESTADOS.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Observación</label>
        <textarea className="text-input" rows={2} value={form.observacion} onChange={set("observacion")} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn-primary" onClick={enviar} disabled={enviando}>
          {enviando ? "Registrando..." : "Registrar"}
        </button>
        {error && <span style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</span>}
        {exito && <span style={{ fontSize: 13, color: "var(--success-text)" }}>{exito}</span>}
      </div>
    </div>
  );
}