import { useEffect, useState } from "react";
import { ChevronLeft, UserPlus, Pencil } from "lucide-react";
import { fetchUsuarios, crearUsuario, editarUsuario } from "../api.js";

export default function UsuariosView() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = () => {
    setLoading(true);
    fetchUsuarios()
      .then(setUsuarios)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
  }, []);

  if (mostrarNuevo) {
    return (
      <NuevoUsuarioForm
        onCancel={() => setMostrarNuevo(false)}
        onCreated={() => {
          setMostrarNuevo(false);
          cargar();
        }}
      />
    );
  }

  if (editando) {
    return (
      <EditarUsuarioForm
        usuario={editando}
        onCancel={() => setEditando(null)}
        onSaved={() => {
          setEditando(null);
          cargar();
        }}
      />
    );
  }

  return (
    <div>
      <button
        className="btn-primary"
        style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, width: "fit-content" }}
        onClick={() => setMostrarNuevo(true)}
      >
        <UserPlus size={16} /> Nuevo usuario
      </button>

      {loading && <p className="empty-note">Cargando...</p>}
      {!loading && usuarios.length === 0 && <p className="empty-note">Todavía no hay usuarios registrados.</p>}

      {!loading && usuarios.length > 0 && (
  <div className="ticket-table-wrap">
    <table className="ticket-table">
      <colgroup>
        <col style={{ width: 140 }} />
        <col style={{ width: 280 }} />
        <col style={{ width: 110 }} />
        <col style={{ width: 120 }} />
        <col style={{ width: 120 }} />
        <col style={{ width: 50 }} />
      </colgroup>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Correo</th>
          <th>Rol</th>
          <th>Área / Carrera</th>
          <th>Estado</th>
          <th className="col-actions"></th>
        </tr>
      </thead>
      <tbody>
        {usuarios.map((u) => (
          <tr key={u.id}>
            <td>{u.nombre_completo}</td>
            <td
              className="mono"
              title={u.correo}
              style={{
                maxWidth: 280,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {u.correo}
            </td>
            <td>
              <span className={`pill ${u.rol === "admin" ? "pill-verif" : "pill-plan"}`}>
                {u.rol === "admin" ? "Admin" : "Usuario"}
              </span>
            </td>
            <td>{u.rol === "usuario" ? u.area || "— sin área —" : "—"}</td>
            <td>
              <span
                className={`pill ${
                  u.activo === true || u.activo === 1 || u.activo === "1"
                    ? "pill-cerrada"
                    : "pill-plan"
                }`}
              >
                {u.activo === true || u.activo === 1 || u.activo === "1"
                  ? "Activo"
                  : "Desactivado"}
              </span>
                   </td>
                    <td className="col-actions">
                     <button className="icon-btn" title="Editar" onClick={() => setEditando(u)}>
                     <Pencil size={15} />
                     </button>
                   </td>
                  </tr>
               ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function NuevoUsuarioForm({ onCancel, onCreated }) {
  const [form, setForm] = useState({
    nombre_completo: "",
    correo: "",
    password: "",
    rol: "usuario",
    sede: "El Alto",
    area: "",
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const enviar = async () => {
    if (!form.nombre_completo.trim() || !form.correo.trim() || !form.password.trim()) {
      setError("Completa nombre, correo y contraseña");
      return;
    }
    if (form.rol === "usuario" && !form.area.trim()) {
      setError("Indica el área o carrera del usuario");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await crearUsuario(form);
      onCreated();
    } catch (e) {
      setError(e.message || "No se pudo crear el usuario");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <button className="back-link" onClick={onCancel}>
        <ChevronLeft size={14} style={{ verticalAlign: -2 }} /> Cancelar
      </button>
      <div className="stage-section active-stage">
        <p className="stage-title">Nuevo usuario</p>

        <div className="grid-2">
          <div>
            <label className="field-label">Nombre completo</label>
            <input className="text-input" value={form.nombre_completo} onChange={set("nombre_completo")} />
          </div>
          <div>
            <label className="field-label">Correo institucional</label>
            <input className="text-input" type="email" value={form.correo} onChange={set("correo")} />
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 12 }}>
          <div>
            <label className="field-label">Contraseña inicial</label>
            <input className="text-input" type="text" value={form.password} onChange={set("password")} />
          </div>
          <div>
            <label className="field-label">Tipo de cuenta</label>
            <select className="text-input" value={form.rol} onChange={set("rol")}>
              <option value="usuario">Usuario — Director/a de Carrera</option>
              <option value="admin">Admin — Sistemas de Gestión</option>
            </select>
          </div>
        </div>

        {form.rol === "usuario" && (
          <div style={{ marginTop: 12, maxWidth: 420 }}>
            <label className="field-label">Área / Carrera (ej. ODO)</label>
            <input
              className="text-input"
              value={form.area}
              onChange={set("area")}
              placeholder="Las acciones de esta área le llegarán a este usuario"
            />
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-primary" onClick={enviar} disabled={enviando}>
            {enviando ? "Creando..." : "Crear usuario"}
          </button>
          {error && <span style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

function EditarUsuarioForm({ usuario, onCancel, onSaved }) {
  const [form, setForm] = useState({
    nombre_completo: usuario.nombre_completo,
    sede: usuario.sede || "El Alto",
    area: usuario.area || "",
    // Normalizar: true solo si es explícitamente activo
    activo: usuario.activo === true || usuario.activo === 1 || usuario.activo === "1",
    password: "",
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const guardar = async () => {
    setEnviando(true);
    setError("");
    try {
      const cambios = {
        nombre_completo: form.nombre_completo,
        sede: usuario.rol === "usuario" ? form.sede : null,
        area: usuario.rol === "usuario" ? form.area.trim() : null,
        activo: Boolean(form.activo), // siempre boolean true/false
      };
      if (form.password.trim()) cambios.password = form.password.trim();
      await editarUsuario(usuario.id, cambios);
      onSaved();
    } catch (e) {
      setError(e.message || "No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <button className="back-link" onClick={onCancel}>
        <ChevronLeft size={14} style={{ verticalAlign: -2 }} /> Cancelar
      </button>
      <div className="stage-section active-stage">
        <p className="stage-title">Editar usuario — {usuario.correo}</p>

        <div className="grid-2">
          <div>
            <label className="field-label">Nombre completo</label>
            <input className="text-input" value={form.nombre_completo} onChange={set("nombre_completo")} />
          </div>
        </div>

        {usuario.rol === "usuario" && (
          <div style={{ marginTop: 12, maxWidth: 420 }}>
            <label className="field-label">Área / Carrera</label>
            <input className="text-input" value={form.area} onChange={set("area")} />
          </div>
        )}

        <div className="grid-2" style={{ marginTop: 12 }}>
          <div>
            <label className="field-label">Nueva contraseña (opcional)</label>
            <input
              className="text-input"
              type="text"
              value={form.password}
              onChange={set("password")}
              placeholder="Dejar vacío para no cambiarla"
            />
          </div>
          <div>
            <label className="field-label">Estado de la cuenta</label>
            <select
              className="text-input"
              value={form.activo ? "1" : "0"}
              onChange={(e) => setForm({ ...form, activo: e.target.value === "1" })}
            >
              <option value="1">Activo</option>
              <option value="0">Desactivado</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-primary" onClick={guardar} disabled={enviando}>
            {enviando ? "Guardando..." : "Guardar cambios"}
          </button>
          {error && <span style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}