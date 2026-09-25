import { useEffect, useState } from "react";
import { Search, FilePlus2, Upload, BarChart3, ClipboardCheck, Send, LogOut, Users } from "lucide-react";
import { fetchRegistros, getToken, getUsuarioGuardado, cerrarSesion } from "./api.js";
import LoginView from "./components/LoginView.jsx";
import BuscarView from "./components/BuscarView.jsx";
import RegistrarView from "./components/RegistrarView.jsx";
import CargarView from "./components/CargarView.jsx";
import PanelView from "./components/PanelView.jsx";
import AccionesMejoraView from "./components/AccionesMejoraView.jsx";
import SolicitudesView from "./components/SolicitudesView.jsx";
import UsuariosView from "./components/UsuariosView.jsx";


const TABS = [
  { key: "buscar", label: "Buscar", icon: Search },
  { key: "registrar", label: "Registrar", icon: FilePlus2 },
  { key: "acciones", label: "Acciones de Mejora", icon: ClipboardCheck },
  { key: "solicitudes", label: "Solicitudes", icon: Send },
  { key: "cargar", label: "Cargar datos", icon: Upload },
  { key: "panel", label: "Panel", icon: BarChart3 },
];

const TAB_USUARIOS = { key: "usuarios", label: "Usuarios", icon: Users };

export default function App() {
  const [usuario, setUsuario] = useState(() => (getToken() ? getUsuarioGuardado() : null));
  const [tab, setTab] = useState("buscar");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [accionSeleccionada, setAccionSeleccionada] = useState(null);
  const [modoAccion, setModoAccion] = useState("ver");

  const loadData = () => {
    setLoading(true);
    fetchRegistros()
      .then((r) => {
        setData(r);
        setError("");
      })
      .catch(() =>
        setError("No se pudo conectar con el servidor. Verifica que el backend esté corriendo.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (usuario) loadData();
  }, [usuario]);

  const handleVerAccionDesdeBusqueda = (accion) => {
    setAccionSeleccionada(accion);
    setModoAccion("ver");
    setTab("acciones");
  };

  const handleEditarAccionDesdeBusqueda = (accion) => {
    setAccionSeleccionada(accion);
    setModoAccion("editar");
    setTab("acciones");
  };

  const salir = () => {
    cerrarSesion();
    setUsuario(null);
  };

  if (!usuario) {
    return <LoginView onLogin={setUsuario} />;
  }

  const iniciales = (usuario.nombre_completo || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  const tabsVisibles = usuario.rol === "admin" ? [...TABS, TAB_USUARIOS] : TABS;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="mark">SG</div>
          <div className="label">Sistema de<br />Mejoras</div>
        </div>

        {tabsVisibles.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              className={`side-item ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <Icon size={20} strokeWidth={1.8} />
              {t.label}
            </button>
          );
        })}
      </aside>

      <div className="main">
        <div className="topbar">
          <div>
            <p className="page-title" style={{ marginBottom: 0 }}>
              {tabsVisibles.find((t) => t.key === tab)?.label}
            </p>
          </div>
          <div className="who">
            <div>
              <div className="name">{usuario.nombre_completo}</div>
              <div className="role">
                {usuario.rol === "admin" ? "Sistemas de Gestión" : `Director/a de Carrera · ${usuario.sede || "—"}`}
              </div>
            </div>
            <div className="avatar">{iniciales}</div>
            <button className="icon-btn" title="Cerrar sesión" onClick={salir} style={{ marginLeft: 10 }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="content">
          {error && (
            <div
              className="card"
              style={{ borderColor: "var(--danger-text)", color: "var(--danger-text)" }}
            >
              {error}
            </div>
          )}

          {!error && loading && <p className="empty-note">Cargando datos del servidor...</p>}

          {!error && !loading && (
            <>
              {tab === "buscar" && (
                <BuscarView
                  usuario={usuario}
                  onVerAccion={handleVerAccionDesdeBusqueda}
                  onEditarAccion={handleEditarAccionDesdeBusqueda}
                />
              )}
              {tab === "registrar" && <RegistrarView />}
              {tab === "acciones" && (
                <AccionesMejoraView
                  usuario={usuario}
                  accionInicial={accionSeleccionada}
                  modoInicial={modoAccion}
                  onClearAccionInicial={() => {
                    setAccionSeleccionada(null);
                    setModoAccion("ver");
                  }}
                />
              )}
              {tab === "solicitudes" && <SolicitudesView usuario={usuario} />}
              {tab === "cargar" && <CargarView />}
              {tab === "panel" && <PanelView />}
              {tab === "usuarios" && <UsuariosView />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}