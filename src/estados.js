// Los valores internos se conservan para los registros y el flujo existentes.
export function nombreEstado(estado) {
  return estado === "Pendiente Plan de Acción" ? "Pendiente de llenado de formulario" : estado;
}

export function colorEstado(estado) {
  return {
    "Pendiente Plan de Acción": "formulario",
    "Pendiente de llenado de formulario": "formulario",
    "Pendiente de evidencia": "evidencia",
    "Pendiente Verificación": "verificacion",
  }[estado];
}
