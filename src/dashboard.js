import { nombreEstado } from "./estados.js";

export const COLORES_ESTADO = {
  "Pendiente Plan de Acción": "#fb7185", Observada: "#fbbf24",
  "En ejecución": "#818cf8", "Pendiente de evidencia": "#fb923c",
  "Pendiente Verificación": "#38bdf8", Cerrada: "#34d399",
};

export function indicadores(acciones, hoy) {
  const estados = {};
  const areas = {};
  const base = new Date(`${hoy}T12:00:00Z`);
  const meses = Array.from({ length: 6 }, (_, i) => {
    const fecha = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 5 + i, 1));
    return { clave: fecha.toISOString().slice(0, 7), mes: fecha.toLocaleDateString("es", { month: "short", year: "2-digit", timeZone: "UTC" }), registradas: 0, cerradas: 0 };
  });
  const abiertas = acciones.filter((a) => a.estado !== "Cerrada");
  acciones.forEach((a) => {
    const estado = a.estado || "Pendiente Plan de Acción";
    estados[estado] = (estados[estado] || 0) + 1;
    const nombres = a.areas?.length ? a.areas : [a.area_responsable || a.procesos || "Sin área"];
    [...new Set(nombres)].forEach((area) => { areas[area] = (areas[area] || 0) + 1; });
    const registro = meses.find((m) => m.clave === a.fecha_creacion?.slice(0, 7));
    if (registro) registro.registradas++;
    const cierre = meses.find((m) => m.clave === (a.fecha_verificacion || a.fecha_cierre_plan)?.slice(0, 7));
    if (a.estado === "Cerrada" && cierre) cierre.cerradas++;
  });
  const vencidas = abiertas.filter((a) => a.alerta_plazo?.nivel === "vencido");
  const proximas = abiertas.filter((a) => a.alerta_plazo?.nivel === "proximo");
  const prioridad = (a) => a.alerta_plazo?.nivel === "vencido" ? 0 : a.alerta_plazo?.nivel === "proximo" ? 1 : 2;
  return {
    total: acciones.length, abiertas: abiertas.length, cerradas: estados.Cerrada || 0,
    porcentaje: acciones.length ? Math.round((estados.Cerrada || 0) / acciones.length * 100) : 0,
    vencidas: vencidas.length, proximas: proximas.length,
    verificacion: estados["Pendiente Verificación"] || 0,
    formularios: (estados["Pendiente Plan de Acción"] || 0) + (estados.Observada || 0),
    evidencia: estados["Pendiente de evidencia"] || 0,
    estados: Object.entries(estados).map(([estado, cantidad]) => ({ estado: nombreEstado(estado), cantidad, color: COLORES_ESTADO[estado] || "#94a3b8" })),
    areas: Object.entries(areas).map(([area, cantidad]) => ({ area, cantidad })).sort((a, b) => b.cantidad - a.cantidad),
    meses,
    prioridades: abiertas.filter((a) => prioridad(a) < 2 || a.estado === "Pendiente Verificación")
      .sort((a, b) => prioridad(a) - prioridad(b) || (a.alerta_plazo?.fecha || "").localeCompare(b.alerta_plazo?.fecha || "") || b.id - a.id),
  };
}
