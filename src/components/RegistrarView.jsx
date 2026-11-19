import CampoGuiado, { GuiaRoles, SeccionGuiada } from "./CampoGuiado.jsx";
import { nombreEstado } from "../estados.js";
import PlazoEntrega, { fechaBolivia, sumarHabiles } from "./PlazoEntrega.jsx";
import { useState } from "react";
import { crearAccion } from "../api.js";
import AreasSelector from "./AreasSelector.jsx";

const ORIGENES = [
  { value: "BS", label: "BS — Buzón de Sugerencias" },
  { value: "ESE", label: "ESE — Encuesta de Satisfacción Estudiantil" },
  { value: "OD", label: "OD — Operación Diaria" },
  { value: "AI", label: "AI — Auditoría Interna" },
];

const ESTADOS = ["Pendiente Plan de Acción", "Observada", "En ejecución", "Pendiente de evidencia", "Pendiente Verificación", "Cerrada"];

const FORM_VACIO = {
  procesos: "",
  fuente_identificacion: "BS",
  numero_ac_original: "",
  declaracion_hallazgo: "",
  plan_accion: "",
  categoria: "",
  subcategoria: "",
  areas: [],
  requiere_cambio_sgc: "No",
  plazo_ejecucion: "",
  fecha_cierre_plan: "",
  estado: "Pendiente Plan de Acción",
  observacion: "",
  sede: "El Alto",
};

export default function RegistrarView() {
  const formularioNuevo = () => ({ ...FORM_VACIO, plazo_entrega_plan: sumarHabiles(fechaBolivia(), 10) });
  const [form, setForm] = useState(formularioNuevo);
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
      setForm(formularioNuevo());
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
        Sistemas de Gestión registra y asigna el hallazgo. El Área Responsable completa la primera parte; Sistemas de Gestión verifica y cierra el caso.
      </p>

      <GuiaRoles />
      <SeccionGuiada>Datos iniciales — Sistemas de Gestión / Administrador</SeccionGuiada>
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
          <label className="field-label">N° de AC (opcional, ej. AM BS-EA-01-26)</label>
          <CampoGuiado rol="gestion" etiqueta="N° de AC (opcional, ej. AM BS-EA-01-26)" guia="X Completa Sistemas de Gestión · Se genera automáticamente si lo dejas vacío"><input
            className="text-input"
            value={form.numero_ac_original}
            onChange={set("numero_ac_original")}
            placeholder="Se genera automático si lo dejas vacío"
          /></CampoGuiado>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Declaración del servicio no conforme / oportunidad de mejora</label>
        <CampoGuiado rol="gestion" etiqueta="Declaración del servicio no conforme / oportunidad de mejora"><textarea className="text-input" rows={3} value={form.declaracion_hallazgo} onChange={set("declaracion_hallazgo")} /></CampoGuiado>
      </div>

      <PlazoEntrega value={form.plazo_entrega_plan} onChange={(fecha) => setForm({ ...form, plazo_entrega_plan: fecha })} />
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Proceso(s)</label>
        <CampoGuiado rol="gestion" etiqueta="Proceso(s)"><input className="text-input" value={form.procesos} onChange={set("procesos")} /></CampoGuiado>
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div>
          <label className="field-label">Categoría</label>
          <CampoGuiado rol="gestion" etiqueta="Categoría"><input className="text-input" value={form.categoria} onChange={set("categoria")} /></CampoGuiado>
        </div>
        <div>
          <label className="field-label">Subcategoría</label>
          <CampoGuiado rol="gestion" etiqueta="Subcategoría"><input className="text-input" value={form.subcategoria} onChange={set("subcategoria")} /></CampoGuiado>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div>
          <label className="field-label">Área(s) Responsable(s) · Asigna Sistemas de Gestión</label>
          <AreasSelector value={form.areas} onChange={(v) => setForm({ ...form, areas: v })} />
        </div>
        <div>
          <label className="field-label">¿Se requiere un cambio en el SGC? · Define Sistemas de Gestión</label>
          <select className="text-input" value={form.requiere_cambio_sgc} onChange={set("requiere_cambio_sgc")}>
            <option value="No">No</option>
            <option value="Sí">Sí</option>
          </select>
        </div>
      </div>

      <SeccionGuiada rol="area">Primera parte — Usuario / Área Responsable</SeccionGuiada>
      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Plan de Acción</label>
        <CampoGuiado rol="area" etiqueta="Plan de Acción" guia="X Completar 1 o más acciones · ¿Cómo eliminamos la causa raíz? ¿Cómo aseguramos que el problema no se repita?"><textarea className="text-input" rows={3} value={form.plan_accion} onChange={set("plan_accion")} /></CampoGuiado>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div>
          <label className="field-label">Plazo del Plan de Acción</label>
          <CampoGuiado rol="area" etiqueta="Plazo del Plan de Acción" guia="X completar el plazo para la ejecución del plan"><input className="text-input" type="date" value={form.plazo_ejecucion} onChange={set("plazo_ejecucion")} /></CampoGuiado>
        </div>
      </div>
      <SeccionGuiada>Seguimiento y cierre — Sistemas de Gestión / Administrador</SeccionGuiada>
      <div style={{ marginBottom: 12 }}>
        <div>
          <label className="field-label">Fecha de Cierre Plan de Acción</label>
          <CampoGuiado rol="gestion" etiqueta="Fecha de Cierre Plan de Acción"><input className="text-input" type="date" value={form.fecha_cierre_plan} onChange={set("fecha_cierre_plan")} /></CampoGuiado>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label className="field-label">Estado</label>
        <CampoGuiado etiqueta="Estado" guia="X Completa Sistemas de Gestión · Selecciona el estado del formulario">
        <select className="text-input" value={form.estado} onChange={set("estado")}>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{nombreEstado(e)}</option>
          ))}
        </select>
        </CampoGuiado>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Observación</label>
        <CampoGuiado rol="gestion" etiqueta="Observación"><textarea className="text-input" rows={2} value={form.observacion} onChange={set("observacion")} /></CampoGuiado>
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
