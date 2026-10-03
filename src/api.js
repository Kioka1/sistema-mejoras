// Cliente de la API — toda la comunicación con el servidor (backend)
// pasa por aquí. Detecta automáticamente si se accede desde el puerto reenviado en VS Code.

const hostname = window.location.hostname;

const BACKEND_URL = (hostname.includes("devtunnels.ms") || hostname.includes("app.github.dev"))
  ? "https://rj02cldk-8000.brs.devtunnels.ms"
  : "http://localhost:8000";

export const API_BASE = `${BACKEND_URL}/api`;

// --- Sesión ---

const TOKEN_KEY = "sgc_token";
const USUARIO_KEY = "sgc_usuario";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUsuarioGuardado() {
  const raw = localStorage.getItem(USUARIO_KEY);
  return raw ? JSON.parse(raw) : null;
}

function guardarSesion(token, usuario) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

export function cerrarSesion() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USUARIO_KEY);
}

export async function login(correo, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Correo o contraseña incorrectos");
  }
  const data = await res.json();
  guardarSesion(data.access_token, data.usuario);
  return data.usuario;
}
// --- Google Auth ---
export const GOOGLE_CLIENT_ID = "349423893149-r827m4h6cof4l312vd0n356l9ob0n73v.apps.googleusercontent.com"; 

export async function loginConGoogle(credential) {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo iniciar sesión con Google");
  }
  const data = await res.json();
  guardarSesion(data.access_token, data.usuario);
  return data.usuario;
}

// Wrapper central: agrega el token a cada pedido y cierra sesión si expiró
async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    cerrarSesion();
    window.location.reload();
  }
  return res;
}

// --- Registros ---

export async function fetchRegistros(query = "") {
  const url = query ? `${API_BASE}/registros?q=${encodeURIComponent(query)}` : `${API_BASE}/registros`;
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
  if (!res.ok) throw new Error("No se pudo guardar el plan de acción");
  return res.json();
}

export async function completarVerificacion(id, data) {
  const res = await authFetch(`${API_BASE}/acciones-mejora/${id}/verificacion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("No se pudo guardar la verificación");
  return res.json();
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
  params.set("token", getToken() || "");
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

// --- Solicitud del Buzón de Sugerencias (lote), recomendaciones, observaciones y evidencias ---

async function errorDe(res, porDefecto) {
  const err = await res.json().catch(() => ({}));
  return new Error(err.detail || porDefecto);
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

export async function subirEvidencia(id, archivo) {
  const formData = new FormData();
  formData.append("archivo", archivo);
  const res = await authFetch(`${API_BASE}/acciones-mejora/${id}/evidencias`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw await errorDe(res, "No se pudo subir la evidencia");
  return res.json();
}

export async function eliminarEvidencia(evidenciaId) {
  const res = await authFetch(`${API_BASE}/evidencias/${evidenciaId}`, { method: "DELETE" });
  if (!res.ok) throw await errorDe(res, "No se pudo eliminar la evidencia");
  return res.json();
}

export function urlDescargarEvidencia(evidenciaId) {
  return `${API_BASE}/evidencias/${evidenciaId}/descargar?token=${encodeURIComponent(getToken() || "")}`;
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