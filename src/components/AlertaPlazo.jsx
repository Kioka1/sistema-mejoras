import { colorEstado } from "../estados.js";

export function claseBadge(estado) {
  const color = colorEstado(estado);
  return color ? `pulse-pending-badge badge-${color}` : "";
}

export function IndicadorEstado({ estado, className = "" }) {
  const color = colorEstado(estado);
  return <span aria-hidden="true" className={`estado-indicador ${color ? `estado-indicador-${color}` : ""} ${className}`}>
    {color && <>
      <span className="estado-indicador-onda animate-ping" />
      <span className="estado-indicador-centro alert-dot-blink" />
    </>}
  </span>;
}

export function claseAlerta(alerta, estado) {
  const color = colorEstado(estado);
  if (color) return `alerta-fila alerta-${color}`;
  return alerta && alerta.nivel !== "pendiente" ? `alerta-fila alerta-${alerta.nivel}` : "";
}

export function fechaVencimiento(accion) {
  if (accion.alerta_plazo) return accion.alerta_plazo.fecha;
  return ["Pendiente Plan de Acción", "Observada"].includes(accion.estado)
    ? accion.plazo_entrega_plan : accion.plazo_evidencias;
}

export default function AlertaPlazo({ alerta }) {
  if (!alerta) return null;
  return <span className={`alerta-etiqueta alerta-texto-${alerta.nivel}`}>
    <span aria-hidden="true">{alerta.nivel === "vencido" ? "⚠" : alerta.nivel === "revision" ? "✓" : "◷"}</span>
    {alerta.tipo}: {alerta.nivel === "pendiente" ? "Pendiente de envío" : alerta.texto}
  </span>;
}
