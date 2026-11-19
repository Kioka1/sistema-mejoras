import test from "node:test";
import assert from "node:assert/strict";
import { indicadores } from "./dashboard.js";

test("cuenta áreas compartidas, plazos activos y prioridades sin incluir cerradas", () => {
  const m = indicadores([
    { id: 1, estado: "Observada", areas: ["TI", "TI", "Calidad"], fecha_creacion: "2026-11-01", alerta_plazo: { nivel: "vencido", fecha: "2026-11-10" } },
    { id: 2, estado: "Pendiente Verificación", area_responsable: "TI", fecha_creacion: "2026-11-03" },
    { id: 3, estado: "Cerrada", areas: ["TI"], fecha_creacion: "2026-10-02", fecha_verificacion: "2026-11-04", alerta_plazo: { nivel: "vencido" } },
    { id: 4, estado: "En ejecución", areas: ["Calidad"], alerta_plazo: { nivel: "proximo", fecha: "2026-11-19" } },
    { id: 5, estado: "Pendiente de evidencia", areas: ["Calidad"], formulario_historico: { seguimiento_activo: false } },
  ], "2026-11-18");
  assert.equal(m.total, 5);
  assert.equal(m.abiertas, 4);
  assert.equal(m.porcentaje, 20);
  assert.equal(m.vencidas, 1);
  assert.equal(m.proximas, 1);
  assert.equal(m.formularios, 1);
  assert.equal(m.evidencia, 1);
  assert.equal(m.areas.find((a) => a.area === "TI").cantidad, 3);
  assert.deepEqual(m.prioridades.map((a) => a.id), [1, 4, 2]);
  assert.deepEqual(m.meses.at(-1), { clave: "2026-11", mes: m.meses.at(-1).mes, registradas: 2, cerradas: 1 });
});

test("el periodo cruza el año y los filtros vacíos no generan porcentajes inválidos", () => {
  const m = indicadores([], "2026-02-01");
  assert.equal(m.porcentaje, 0);
  assert.equal(m.meses[0].clave, "2025-09");
  assert.equal(m.meses.at(-1).clave, "2026-02");
  assert.deepEqual(m.prioridades, []);
});
