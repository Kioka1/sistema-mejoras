import { useState } from "react";
import { LogIn } from "lucide-react";
import { login } from "../api.js";

export default function LoginView({ onLogin }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const usuario = await login(correo, password);
      onLogin(usuario);
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={enviar}>
        <div className="login-brand">
          <div className="mark">SG</div>
          <h1>Sistema de Mejoras</h1>
          <p>Sistemas de Gestión — Unifranz</p>
        </div>

        <label className="field-label">Correo institucional</label>
        <input
          className="text-input"
          type="email"
          autoFocus
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        <label className="field-label">Contraseña</label>
        <input
          className="text-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: 18 }}
        />

        {error && <p style={{ color: "var(--danger-text)", fontSize: 13, marginBottom: 14 }}>{error}</p>}

        <button
          className="btn-primary"
          type="submit"
          disabled={cargando}
          style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
        >
          <LogIn size={16} />
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}