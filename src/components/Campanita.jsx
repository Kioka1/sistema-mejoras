import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { fetchNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from "../api.js";

const CADA_MS = 60 * 1000; // se revisa si hay avisos nuevos cada minuto

export default function Campanita({ onAbrirAccion }) {
  const [abierta, setAbierta] = useState(false);
  const [items, setItems] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [error, setError] = useState(false);
  const contenedor = useRef(null);

  const cargar = () =>
    fetchNotificaciones()
      .then((r) => {
        setItems(r.items || []);
        setNoLeidas(r.no_leidas || 0);
        setError(false);
      })
      .catch(() => setError(true));

  // Al entrar, cada minuto y al volver a la pestaña
  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, CADA_MS);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  // Cerrar al hacer clic afuera o con Escape
  useEffect(() => {
    if (!abierta) return;
    const afuera = (e) => contenedor.current && !contenedor.current.contains(e.target) && setAbierta(false);
    const esc = (e) => e.key === "Escape" && setAbierta(false);
    document.addEventListener("mousedown", afuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierta]);

  const alternar = () => {
    if (!abierta) cargar();
    setAbierta(!abierta);
  };

  const abrirAviso = async (n) => {
    if (!n.leida) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      setNoLeidas((c) => Math.max(0, c - 1));
      marcarNotificacionLeida(n.id).catch(() => cargar());
    }
    if (n.accion_id && onAbrirAccion) {
      setAbierta(false);
      onAbrirAccion(n.accion_id);
    }
  };

  const leerTodas = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, leida: true })));
    setNoLeidas(0);
    marcarTodasLeidas().catch(() => cargar());
  };

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"}
        aria-expanded={abierta}
        title="Notificaciones"
        className="relative p-2 rounded-lg bg-dark-card border border-dark-border cursor-pointer text-slate-300 hover:text-white hover:bg-dark-cardHover transition-colors"
      >
        <Bell size={16} />
        {noLeidas > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>

      {abierta && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 mt-2 w-[380px] max-w-[90vw] rounded-xl bg-dark-surface border border-dark-border shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
            <span className="text-sm font-semibold text-white">Notificaciones</span>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={leerTodas}
                className="flex items-center gap-1.5 p-0 border-0 bg-transparent cursor-pointer text-[11px] font-medium text-brand-400 hover:text-brand-100"
              >
                <CheckCheck size={13} /> Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {error && (
              <p className="px-4 py-3 text-xs text-rose-400">No se pudo conectar para revisar avisos nuevos.</p>
            )}
            {items.length === 0 && !error && (
              <p className="px-4 py-8 text-center text-xs text-slate-400">Todavía no tienes notificaciones.</p>
            )}
            {items.map((n) => (
              <div key={n.id} className="border-b border-dark-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => abrirAviso(n)}
                  className={
                    "w-full text-left px-4 py-3 border-0 cursor-pointer hover:bg-white/[0.04] transition-colors flex gap-3 " +
                    (n.leida ? "bg-transparent" : "bg-brand-500/[0.06]")
                  }
                >
                  <span
                    className={"mt-1.5 w-2 h-2 rounded-full flex-shrink-0 " + (n.leida ? "bg-transparent" : "bg-brand-500")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={"block text-[13px] leading-snug " + (n.leida ? "text-slate-300" : "text-white font-semibold")}>
                      {n.asunto}
                    </span>
                    <span className="block text-xs text-slate-400 mt-0.5 line-clamp-2 whitespace-pre-line">{n.mensaje}</span>
                    <span className="block text-[11px] text-slate-500 mt-1">
                      {n.fecha}
                      {n.accion_id ? " · clic para abrir la acción" : ""}
                    </span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}