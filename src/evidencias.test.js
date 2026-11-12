import test from "node:test";
import assert from "node:assert/strict";
import { nombreCoincide, nombresEsperados } from "./evidencias.js";

test("nombres equivalentes ignoran extensión, acentos, espacios y guiones bajos", () => {
  assert.equal(nombreCoincide("INFORME_DE_CAPACITACION.docx", "Informe de capacitación.pdf"), true);
  assert.equal(nombreCoincide("informe.pdf", "informe final.pdf"), false);
  assert.equal(nombreCoincide("", ""), false);
});

test("cada línea define un casillero, incluso con saltos de Windows", () => {
  assert.deepEqual(nombresEsperados(" Informe.pdf\r\n\r\nLista de asistencia.pdf \n"),
    ["Informe.pdf", "Lista de asistencia.pdf"]);
});
