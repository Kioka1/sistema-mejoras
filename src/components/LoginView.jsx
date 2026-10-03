import { useEffect, useRef, useState } from "react";
import { LogIn } from "lucide-react";
import { login, loginConGoogle, GOOGLE_CLIENT_ID } from "../api.js";

export default function LoginView({ onLogin }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const botonGoogleRef = useRef(null);
  const [anchoBoton, setAnchoBoton] = useState(320);

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

  useEffect(() => {
    const medir = () => {
      if (botonGoogleRef.current) {
        setAnchoBoton(botonGoogleRef.current.clientWidth);
      }
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  useEffect(() => {
    const manejarRespuestaGoogle = async (respuesta) => {
      setError("");
      setCargando(true);
      try {
        const usuario = await loginConGoogle(respuesta.credential);
        onLogin(usuario);
      } catch (err) {
        setError(err.message || "No se pudo iniciar sesión con Google");
      } finally {
        setCargando(false);
      }
    };

    const intentarMontarBoton = () => {
      if (!window.google || !botonGoogleRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: manejarRespuestaGoogle,
      });
      window.google.accounts.id.renderButton(botonGoogleRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        width: anchoBoton,
        text: "signin_with",
        logo_alignment: "center",
      });
      return true;
    };

    if (!intentarMontarBoton()) {
      const intervalo = setInterval(() => {
        if (intentarMontarBoton()) clearInterval(intervalo);
      }, 300);
      return () => clearInterval(intervalo);
    }
  }, [anchoBoton]); // eslint-disable-line react-hooks/exhaustive-deps

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

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>o</span>
          <div style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
        </div>

        <div ref={botonGoogleRef} style={{ display: "flex", justifyContent: "center" }} />
        <p style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", marginTop: 10, marginBottom: 0 }}>
          Solo correos institucionales @unifranz.edu.bo
        </p>
      </form>
    </div>
  );
}