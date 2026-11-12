import test from "node:test";
import assert from "node:assert/strict";
import { nombreEstado, colorEstado } from "./estados.js";

test("el nombre visible del formulario mantiene compatibles los estados existentes", () => {
  assert.equal(nombreEstado("Pendiente Plan de Acción"), "Pendiente de llenado de formulario");
  for (const estado of ["Observada", "En ejecución", "Pendiente de evidencia", "Pendiente Verificación", "Cerrada"]) {
    assert.equal(nombreEstado(estado), estado);
  }
});

test("solo las tres etapas solicitadas tienen color de parpadeo propio", () => {
  assert.equal(colorEstado("Pendiente Plan de Acción"), "formulario");
  assert.equal(colorEstado("Pendiente de evidencia"), "evidencia");
  assert.equal(colorEstado("Pendiente Verificación"), "verificacion");
  assert.equal(colorEstado("Cerrada"), undefined);
  assert.equal(colorEstado("En ejecución"), undefined);
});
