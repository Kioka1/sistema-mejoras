// La API se publica en el mismo origen que el frontend.
export const API_BASE = "/api";
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ??
  "349423893149-r827m4h6cof4l312vd0n356l9ob0n73v.apps.googleusercontent.com";

// Elimina las credenciales que pudieron quedar de la versión anterior.
try {
  localStorage.removeItem("sgc_token");
  localStorage.removeItem("sgc_usuario");
} catch {
  // El navegador puede bloquear el acceso al almacenamiento local.
}

export async function consultarSesion() {
  const res = await fetch(`${API_BASE}/auth/me`);
  if (res.status === 401) return null;
  if (!res.ok) throw await errorDe(res, "No se pudo comprobar la sesión.");
  return res.json();
}

export async function cerrarSesion() {
  const res = await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
  if (!res.ok && res.status !== 401) throw await errorDe(res, "No se pudo cerrar la sesión.");
  window.dispatchEvent(new Event("sesion-terminada"));
}

export async function login(correo, password) {
  return autenticar("login", { correo, password }, "Correo o contraseña incorrectos.");
}

export async function obtenerDesafioGoogle() {
  const res = await fetch(`${API_BASE}/auth/google/desafio`, { method: "POST" });
  if (!res.ok) throw await errorDe(res, "El inicio de sesión con Google no está disponible.");
  return (await res.json()).nonce;
}

export async function loginConGoogle(credential, passwordVinculacion) {
  return autenticar("google", { credential, password_vinculacion: passwordVinculacion },
    "No se pudo iniciar sesión con Google.");
}

async function autenticar(ruta, datos, mensaje) {
  const res = await fetch(`${API_BASE}/auth/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const error = await errorDe(res, mensaje);
    error.status = res.status;
    throw error;
  }
  return (await res.json()).usuario;
}

export async function registrarActividad() {
  await authFetch(`${API_BASE}/auth/actividad`, { method: "POST" });
}

async function authFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.dispatchEvent(new Event("sesion-terminada"));
  }
  if (res.ok && options.method && options.method !== "GET" && !url.includes("/notificaciones")
      && !url.includes("/auth/")) {
    window.dispatchEvent(new Event("entregas-actualizadas"));
  }
  return res;
}

// --- Notificaciones (la campanita) ---

export async function fetchNotificaciones() {
  const res = await authFetch(`${API_BASE}/notificaciones`);
  if (!res.ok) throw new Error("No se pudieron cargar las notificaciones");
  return res.json(); // { no_leidas, items: [{ id, asunto, mensaje, fecha, leida, accion_id }] }
}

export async function marcarNotificacionLeida(id) {
  const res = await authFetch(`${API_BASE}/notificaciones/${id}/leer`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudo marcar como leída");
  return res.json();
}

export async function marcarTodasLeidas() {
  const res = await authFetch(`${API_BASE}/notificaciones/leer-todas`, { method: "POST" });
  if (!res.ok) throw new Error("No se pudieron marcar como leídas");
  return res.json();
}

// --- Registros ---

export async function fetchRegistros(query = "") {
  const url = query
    ? `${API_BASE}/registros?q=${encodeURIComponent(query)}`
    : `${API_BASE}/registros`;
  const res = await authFetch(url);
  if (!res.ok) throw new Error("No se pudo cargar los registros");
  return res.json();
}

export async function fetchRelacionados(id) {
  const res = await authFetch(`${API_BASE}/registros/${id}/relacionados`);
  if (!res.ok) throw new Error("No se pudo cargar los registros relacionados");
  return res.json();
}

export async function crearRegistro(registro) {
  const res = await authFetch(`${API_BASE}/registros`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(registro),
  });
  if (!res.ok) throw new Error("No se pudo guardar el registro");
  return res.json();
}

export async function fetchDashboard() {
  const res = await authFetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error("No se pudo cargar el panel");
  return res.json();
}

// --- Acciones de Mejora ---

export async function fetchAcciones() {
  const res = await authFetch(`${API_BASE}/acciones-mejora`);
  if (!res.ok) throw new Error("No se pudo cargar las acciones de mejora");
  return res.json();
}

export async function crearAccion(data) {
  const res = await authFetch(`${API_BASE}/acciones-mejora`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("No se pudo crear la acción de mejora");
  return res.json();
}

export async function completarPlanAccion(id, data) {
  const res = await authFetch(`${API_BASE}/acciones-mejora/${id}/plan-accion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await errorDe(res, "No se pudo guardar el plan de acción");
  return res.json();
}

export async function completarVerificacion(id, data) {
  const res = await authFetch(`${API_BASE}/acciones-mejora/${id}/verificacion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await errorDe(res, "No se pudo guardar la verificación");
  return res.json();
}

export async function descargarFormularioWord(accion, firmaSello = null) {
  const form = new FormData();
  if (firmaSello) form.append("firma_sello", firmaSello);
  const res = await authFetch(`${API_BASE}/acciones-mejora/${accion.id}/formulario-word`, {
    method: "POST", body: form,
  });
  if (!res.ok) throw await errorDe(res, "No se pudo generar el formulario Word");
  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${accion.numero_ac_original || accion.numero} - Cerrada.docx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function editarAccion(id, data) {
  const res = await authFetch(`${API_BASE}/acciones-mejora/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("No se pudo guardar la edición");
  return res.json();
}

export function urlExportarAcciones(filtro, anio, columnas, ids) {
  const params = new URLSearchParams({ filtro });
  if (anio) params.set("anio", anio);
  if (columnas && columnas.length) params.set("columnas", columnas.join(","));
  if (ids && ids.length) params.set("ids", ids.join(","));
  return `${API_BASE}/acciones-mejora/exportar?${params.toString()}`;
}

export async function importarExcelAcciones(archivo) {
  const formData = new FormData();
  formData.append("archivo", archivo);
  const res = await authFetch(`${API_BASE}/acciones-mejora/importar-excel`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo importar el archivo");
  }
  return res.json();
}

export async function revisarFormularioWord(archivo) {
  const form = new FormData();
  form.append("archivo", archivo);
  const res = await authFetch(`${API_BASE}/acciones-mejora/previsualizar-formulario`, { method: "POST", body: form });
  if (!res.ok) throw await errorDe(res, "No se pudo leer el formulario Word");
  return res.json();
}

export async function importarFormularioWord(archivo, datos) {
  const form = new FormData();
  form.append("archivo", archivo);
  form.append("datos", JSON.stringify(datos));
  const res = await authFetch(`${API_BASE}/acciones-mejora/importar-formulario`, { method: "POST", body: form });
  if (!res.ok) throw await errorDe(res, "No se pudo importar el formulario");
  return res.json();
}

export function urlFormularioHistorico(id) {
  return `${API_BASE}/formularios-historicos/${id}/descargar`;
}

export async function cambiarSeguimientoHistorico(id, activo) {
  const res = await authFetch(`${API_BASE}/formularios-historicos/${id}/seguimiento`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo }),
  });
  if (!res.ok) throw await errorDe(res, "No se pudo cambiar el seguimiento");
  return res.json();
}

// --- Solicitud del Buzón de Sugerencias (lote), recomendaciones, observaciones y evidencias ---

async function errorDe(res, porDefecto) {
  const err = await res.json().catch(() => ({}));
  return new Error(typeof err.detail === "string" ? err.detail : porDefecto);
}

export async function crearLoteAcciones(data) {
  const res = await authFetch(`${API_BASE}/acciones-mejora/lote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await errorDe(res, "No se pudo enviar la solicitud");
  return res.json();
}

export async function fetchAreas() {
  const res = await authFetch(`${API_BASE}/areas`);
  if (!res.ok) throw new Error("No se pudo cargar las áreas");
  return res.json();
}

// Crea un área nueva en el catálogo y devuelve la lista actualizada

export async function crearArea(nombre) {
  const res = await authFetch(`${API_BASE}/areas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre }),
  });
  if (!res.ok) throw await errorDe(res, "No se pudo crear el área");
  return res.json();
}

// El área terminó de subir sus archivos: pasa a verificación de Sistemas de Gestión

export async function enviarEvidencia(id) {
  const res = await authFetch(`${API_BASE}/acciones-mejora/${id}/enviar-evidencia`, {
    method: "POST",
  });
  if (!res.ok) throw await errorDe(res, "No se pudo enviar la evidencia");
  return res.json();
}

export async function fetchRecomendaciones() {
  const res = await authFetch(`${API_BASE}/recomendaciones`);
  if (!res.ok) throw new Error("No se pudo cargar las recomendaciones");
  return res.json();
}

export async function enviarObservacion(id, texto) {
  const res = await authFetch(`${API_BASE}/acciones-mejora/${id}/observacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
  if (!res.ok) throw await errorDe(res, "No se pudo enviar la observación");
  return res.json();
}

// --- Evidencias ---

// Cambia a cuál acción del plan corresponde un archivo ya subido
// null = sin asignar

export async function asignarEvidencia(evidenciaId, planItemId) {
  const res = await authFetch(`${API_BASE}/evidencias/${evidenciaId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_item_id: planItemId }),
  });
  if (!res.ok) throw await errorDe(res, "No se pudo asignar el archivo");
  return res.json();
}

export async function subirEvidencia(id, archivo, planItemId = null) {
  const formData = new FormData();
  formData.append("archivo", archivo);
  if (planItemId !== null && planItemId !== undefined) {
    formData.append("plan_item_id", String(planItemId));
  }
  const res = await authFetch(`${API_BASE}/acciones-mejora/${id}/evidencias`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw await errorDe(res, "No se pudo subir la evidencia");
  return res.json();
}

export async function eliminarEvidencia(evidenciaId) {
  const res = await authFetch(`${API_BASE}/evidencias/${evidenciaId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await errorDe(res, "No se pudo eliminar la evidencia");
  return res.json();
}

export function urlDescargarEvidencia(evidenciaId) {
  return `${API_BASE}/evidencias/${evidenciaId}/descargar`;
}

// --- Solicitudes (módulo independiente) ---

export async function fetchSolicitudes() {
  const res = await authFetch(`${API_BASE}/solicitudes`);
  if (!res.ok) throw new Error("No se pudo cargar las solicitudes");
  return res.json();
}

export async function crearSolicitud(data) {
  const res = await authFetch(`${API_BASE}/solicitudes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("No se pudo crear la solicitud");
  return res.json();
}

export async function responderSolicitud(id, data) {
  const res = await authFetch(`${API_BASE}/solicitudes/${id}/responder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("No se pudo enviar la respuesta");
  return res.json();
}

export async function editarSolicitud(id, data) {
  const res = await authFetch(`${API_BASE}/solicitudes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("No se pudo guardar la edición");
  return res.json();
}

// --- Usuarios (solo admin) ---

export async function fetchUsuarios() {
  const res = await authFetch(`${API_BASE}/usuarios`);
  if (!res.ok) throw new Error("No se pudo cargar los usuarios");
  return res.json();
}

export async function crearUsuario(data) {
  const res = await authFetch(`${API_BASE}/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo crear el usuario");
  }
  return res.json();
}

export async function editarUsuario(id, data) {
  const res = await authFetch(`${API_BASE}/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo guardar los cambios");
  }
  return res.json();
}
