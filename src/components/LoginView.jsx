import { useEffect, useRef, useState } from "react";
import { LogIn } from "lucide-react";
import { login, loginConGoogle, obtenerDesafioGoogle, GOOGLE_CLIENT_ID } from "../api.js";

export default function LoginView({ onLogin, aviso }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [credencialPendiente, setCredencialPendiente] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const botonGoogleRef = useRef(null);
  const desafioGoogleRef = useRef(null);
  const [anchoBoton, setAnchoBoton] = useState(320);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const usuario = credencialPendiente
        ? await loginConGoogle(credencialPendiente, password)
        : await login(correo, password);
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
        if (err.status === 409) {
          setPassword("");
          setCredencialPendiente(respuesta.credential);
        }
        setError(err.message || "No se pudo iniciar sesión con Google");
      } finally {
        setCargando(false);
      }
    };

    if (!GOOGLE_CLIENT_ID) return;
    let activo = true;
    let intervalo;
    desafioGoogleRef.current ??= obtenerDesafioGoogle();
    desafioGoogleRef.current.then((nonce) => {
      if (!activo) return;
      const intentarMontarBoton = () => {
        if (!window.google || !botonGoogleRef.current) return false;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce,
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
        intervalo = setInterval(() => {
          if (intentarMontarBoton()) clearInterval(intervalo);
        }, 300);
      }
    }).catch((err) => {
      if (activo) setError(err.message);
    });
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [anchoBoton]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={enviar}>
        <div className="login-brand">
          <div className="mark">SG</div>
          <h1>Sistema de Mejoras</h1>
          <p>Sistemas de Gestión — Unifranz</p>
        </div>

        {!credencialPendiente && (
          <>
            <label className="field-label">Correo institucional</label>
            <input
              className="text-input"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
              autoFocus
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              style={{ marginBottom: 14 }}
            />
          </>
        )}
        <label className="field-label">
          {credencialPendiente ? "Contraseña para vincular tu cuenta" : "Contraseña"}
        </label>
        <input
          className="text-input"
          type="password"
          autoComplete="current-password"
          maxLength={72}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: 18 }}
        />

        {(error || aviso) && <p role="alert" style={{ color: "var(--danger-text)", fontSize: 13, marginBottom: 14 }}>{error || aviso}</p>}

        <button
          className="btn-primary"
          type="submit"
          disabled={cargando}
          style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
        >
          <LogIn size={16} />
          {cargando ? "Ingresando..." : credencialPendiente ? "Vincular e ingresar" : "Ingresar"}
        </button>
        {credencialPendiente && (
          <button type="button" className="back-link" onClick={() => {
            setCredencialPendiente(null);
            setPassword("");
            setError("");
          }}>
            Cancelar vinculación
          </button>
        )}

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
