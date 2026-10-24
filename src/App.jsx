import { useEffect, useState } from "react";
import {
  Search,
  FilePlus2,
  Upload,
  BarChart3,
  ClipboardCheck,
  LogOut,
  Users,
  ChevronRight,
} from "lucide-react";
import { fetchAcciones, getToken, getUsuarioGuardado, cerrarSesion } from "./api.js";
import LoginView from "./components/LoginView.jsx";
import BuscarView from "./components/BuscarView.jsx";
import RegistrarView from "./components/RegistrarView.jsx";
import CargarView from "./components/CargarView.jsx";
import PanelView from "./components/PanelView.jsx";
import AccionesMejoraView from "./components/AccionesMejoraView.jsx";
import UsuariosView from "./components/UsuariosView.jsx";
import Campanita from "./components/Campanita.jsx";

const TABS = [
  { key: "buscar", label: "Buscar", icon: Search },
  { key: "registrar", label: "Registrar", icon: FilePlus2 },
  { key: "acciones", label: "Acciones de Mejora", icon: ClipboardCheck },
  { key: "cargar", label: "Cargar datos", icon: Upload },
  { key: "panel", label: "Panel de Control", icon: BarChart3 },
];

const TAB_USUARIOS = { key: "usuarios", label: "Usuarios", icon: Users };

// Los Directores/as de Carrera no registran ni cargan datos: solo ven sus acciones.
const TABS_SOLO_ADMIN = ["registrar", "cargar"];

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
    fetchAcciones()
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

  const tabsVisibles =
    usuario.rol === "admin"
      ? [...TABS, TAB_USUARIOS]
      : TABS.filter((t) => !TABS_SOLO_ADMIN.includes(t.key));

  const tabActual = tabsVisibles.find((t) => t.key === tab);

  // Métricas rápidas del encabezado
  const lista = Array.isArray(data) ? data : [];
  const total = lista.length;
  const pendientes = lista.filter((a) => a.estado !== "Cerrada").length;
  const cerradas = lista.filter((a) => a.estado === "Cerrada").length;

  const rolTexto =
    usuario.rol === "admin"
      ? "Sistemas de Gestión"
      : `Director/a de Carrera · ${usuario.sede || "—"}`;

  return (
    <div className="flex h-screen overflow-hidden bg-dark-base text-slate-200 font-sans antialiased selection:bg-brand-500/25 selection:text-orange-200">
      {/* ================= SIDEBAR ================= */}
      <aside className="w-64 flex-shrink-0 bg-dark-sidebar border-r border-dark-border flex flex-col justify-between z-20 select-none">
        <div className="flex flex-col min-h-0">
          {/* Marca */}
          <div className="h-20 flex items-center px-6 gap-3.5 border-b border-dark-border flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center font-bold text-white text-base tracking-wider shadow-[0_0_20px_-3px_rgba(249,115,22,0.35)]">
              SG
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white tracking-tight">
                Sistema de Mejoras
              </span>
              <span className="text-[11px] font-medium text-slate-400">Calidad &amp; Gestión</span>
            </div>
          </div>

          {/* Navegación */}
          <nav aria-label="Navegación principal" className="p-3.5 space-y-1.5 overflow-y-auto">
            {tabsVisibles.map((t) => {
              const Icon = t.icon;
              const activo = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={
                    activo
                      ? "relative group w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl bg-brand-500/10 text-brand-400 font-medium text-sm text-left border border-brand-500/20 shadow-[0_0_20px_-3px_rgba(249,115,22,0.35)] transition-all duration-200"
                      : "relative group w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl bg-transparent border border-transparent text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] font-medium text-sm text-left transition-all duration-150"
                  }
                >
                  {activo && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-500" />
                  )}
                  <Icon
                    size={20}
                    strokeWidth={2}
                    className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                  />
                  <span className="truncate">{t.label}</span>
                  {activo && (
                    <span className="ml-auto text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/30">
                      Activo
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sesión del usuario */}
        <div className="p-3.5 border-t border-dark-border flex-shrink-0">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-dark-surface border border-dark-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center font-bold text-white text-xs ring-2 ring-white/10 flex-shrink-0">
                {iniciales || "U"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-200 truncate">
                  {usuario.nombre_completo}
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate">{rolTexto}</span>
              </div>
            </div>
            <button
              type="button"
              title="Cerrar sesión"
              onClick={salir}
              className="p-1.5 rounded-lg bg-transparent text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ================= ÁREA PRINCIPAL ================= */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-dark-base">
        {/* Barra superior */}
        <header className="h-16 flex-shrink-0 border-b border-dark-border bg-dark-surface/70 backdrop-blur-md px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-slate-400">Sistema de Mejoras</span>
            <ChevronRight size={14} className="text-slate-600" />
            <span className="text-xs font-semibold text-orange-400/90 tracking-wide">
              {tabActual?.label}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <Campanita onAbrirAccion={(id) => handleVerAccionDesdeBusqueda({ id })} />
            <div className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="text-slate-400">Total:</span>
              <span className="font-semibold text-slate-200 font-mono">{total}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-brand-400">Pendientes:</span>
              <span className="font-semibold text-white font-mono">{pendientes}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400">Cerradas:</span>
              <span className="font-semibold text-white font-mono">{cerradas}</span>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-8 py-7 pb-16 max-w-[1200px]">
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
                {tab === "cargar" && <CargarView />}
                {tab === "panel" && <PanelView />}
                {tab === "usuarios" && <UsuariosView />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
