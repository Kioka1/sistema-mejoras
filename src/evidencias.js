const extensiones = /\.(pdf|xls|xlsx|csv|doc|docx|jpg|jpeg|png|webp)$/i;

export const normalizarNombre = (nombre = "") => nombre.trim().replace(extensiones, "")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_]+/g, "");

export const nombresEsperados = (texto = "") => (texto || "").split(/\r?\n/).map((n) => n.trim()).filter(Boolean);

export const nombreCoincide = (nombre, esperado) => !!normalizarNombre(nombre)
  && normalizarNombre(nombre) === normalizarNombre(esperado);
