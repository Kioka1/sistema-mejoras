import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Eye, Edit3, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchAcciones, urlExportarAcciones } from "../api";

const POR_PAGINA = 10;

const ESTADOS = [
  "Pendiente Plan de Acción",
  "Observada",
  "Pendiente Verificación",
  "Cerrada",
];

// Colores del badge de estado (clases completas para que Tailwind las detecte)
const ESTADO_STYLE = {
  "Pendiente Plan de Acción": {
    badge: "bg-amber-500/10 border-amber-500/25 text-amber-400",
    dot: "bg-amber-400 animate-pulse",
  },
  "Pendiente Verificación": {
    badge: "bg-sky-500/10 border-sky-500/25 text-sky-400",
    dot: "bg-sky-400",
  },
  Cerrada: {
    badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    dot: "bg-emerald-400",
  },
  Observada: {
    badge: "bg-rose-500/10 border-rose-500/25 text-rose-400",
    dot: "bg-rose-400",
  },
};

const ESTADO_DEFAULT = {
  badge: "bg-slate-500/10 border-slate-500/25 text-slate-300",
  dot: "bg-slate-400",
};

// Colores del badge de área (se asigna uno según el nombre del área)
const AREA_STYLES = [
  "bg-indigo-500/10 border-indigo-500/20 text-indigo-300",
  "bg-purple-500/10 border-purple-500/20 text-purple-300",
  "bg-teal-500/10 border-teal-500/20 text-teal-300",
  "bg-sky-500/10 border-sky-500/20 text-sky-300",
  "bg-pink-500/10 border-pink-500/20 text-pink-300",
];

function estiloArea(area) {
  let h = 0;
  for (let i = 0; i < area.length; i++) h = (h * 31 + area.charCodeAt(i)) % 9973;
  return AREA_STYLES[h % AREA_STYLES.length];
}

const obtenerNumeroAccion = (item) => {
  if (item.numero_ac_original) return item.numero_ac_original;
  if (item.numero_accion) return item.numero_accion;
  const num = String(item.id || 1).padStart(2, "0");
  return `AM BS-EA-${num}-26`;
};

const obtenerArea = (item) => item.area_responsable || item.procesos || "";
const obtenerDescripcion = (item) =>
  item.hallazgo_asunto || item.hallazgo || item.declaracion_hallazgo || "";

export default function BuscarView({ usuario, onVerAccion, onEditarAccion }) {
  const esAdmin = usuario?.rol === "admin";
  const [query, setQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [pagina, setPagina] = useState(1);
  const [acciones, setAcciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    cargarDatosReales();
  }, []);

  // Atajo Ctrl/⌘ + K para enfocar el buscador
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const cargarDatosReales = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await fetchAcciones();
      setAcciones(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("No se pudo conectar con la base de datos.");
    } finally {
      setCargando(false);
    }
  };

  // Áreas disponibles, tomadas de las propias acciones cargadas
  const areas = useMemo(() => {
    const set = new Set();
    acciones.forEach((a) => {
      const ar = obtenerArea(a).trim();
      if (ar) set.add(ar);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [acciones]);

  const q = query.toLowerCase().trim();
  const resultados = useMemo(
    () =>
      acciones.filter((item) => {
        const numAccion = obtenerNumeroAccion(item).toLowerCase();
        const hallazgo = obtenerDescripcion(item).toLowerCase();
        const area = obtenerArea(item).toLowerCase();
        const solicitante = (item.solicitante || "").toLowerCase();
        const categoria = (item.categoria || "").toLowerCase();
        const subcategoria = (item.subcategoria || "").toLowerCase();
        const estadoItem = (item.estado || "").toLowerCase();

        const coincideTexto =
          !q ||
          numAccion.includes(q) ||
          hallazgo.includes(q) ||
          area.includes(q) ||
          solicitante.includes(q) ||
          categoria.includes(q) ||
          subcategoria.includes(q);

        const coincideEstado = !filtroEstado || estadoItem === filtroEstado.toLowerCase();
        const coincideArea = !filtroArea || obtenerArea(item).trim() === filtroArea;

        return coincideTexto && coincideEstado && coincideArea;
      }),
    [acciones, q, filtroEstado, filtroArea]
  );

  const totalPaginas = Math.max(1, Math.ceil(resultados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const visibles = resultados.slice(inicio, inicio + POR_PAGINA);

  const hayFiltros = !!(query || filtroEstado || filtroArea);

  const restablecer = () => {
    setQuery("");
    setFiltroEstado("");
    setFiltroArea("");
    setPagina(1);
  };

  const exportar = () => {
    const ids = hayFiltros ? resultados.map((r) => r.id).filter(Boolean) : [];
    window.open(urlExportarAcciones("todos", null, null, ids), "_blank");
  };

  const esMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || "");

  const inputBase =
    "w-full text-xs text-slate-100 placeholder-slate-400 bg-dark-base border border-dark-border rounded-xl focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all duration-150";

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-tight text-white">
            Gestión de Acciones &amp; Hallazgos
          </h1>
          <p className="m-0 mt-1 text-xs text-slate-400">
            Busque, filtre y gestione las acciones de mejora, incidencias y planes de corrección.
          </p>
        </div>

        {esAdmin && (
          <button
            type="button"
            onClick={exportar}
            disabled={resultados.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-dark-card hover:bg-slate-800 border border-dark-border rounded-xl transition-all duration-150 self-start sm:self-auto disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={16} className="text-slate-400" />
            Exportar reporte
          </button>
        )}
      </div>

      {/* Panel de búsqueda y filtros */}
      <section className="p-4 rounded-2xl bg-dark-surface border border-dark-border shadow-xl space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* Texto */}
          <div className="relative md:col-span-6 lg:col-span-7">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              ref={inputRef}
              type="text"
              className={`${inputBase} pl-10 pr-20 py-2.5`}
              placeholder="Buscar por código, hallazgo, área, categoría..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPagina(1);
              }}
            />
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
              <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/60 rounded-md">
                {esMac ? "⌘K" : "Ctrl K"}
              </kbd>
            </div>
          </div>

          {/* Estado */}
          <div className="md:col-span-3 lg:col-span-3">
            <select
              className={`${inputBase} py-2.5 pl-3.5 pr-8 cursor-pointer [color-scheme:dark]`}
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          {/* Área */}
          <div className="md:col-span-3 lg:col-span-2">
            <select
              className={`${inputBase} py-2.5 pl-3.5 pr-8 cursor-pointer [color-scheme:dark]`}
              value={filtroArea}
              onChange={(e) => {
                setFiltroArea(e.target.value);
                setPagina(1);
              }}
            >
              <option value="">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtros aplicados */}
        <div className="flex items-center flex-wrap gap-2 pt-3 border-t border-dark-border text-xs">
          <span className="text-slate-400 text-[11px] font-medium mr-1">
            {hayFiltros ? "Filtros aplicados:" : "Sin filtros aplicados"}
          </span>

          {query && (
            <Chip onQuitar={() => setQuery("")}>Búsqueda: “{query}”</Chip>
          )}
          {filtroEstado && (
            <Chip onQuitar={() => setFiltroEstado("")}>Estado: {filtroEstado}</Chip>
          )}
          {filtroArea && <Chip onQuitar={() => setFiltroArea("")}>Área: {filtroArea}</Chip>}

          {hayFiltros && (
            <button
              type="button"
              onClick={restablecer}
              className="ml-auto bg-transparent border-0 text-[11px] text-slate-400 hover:text-brand-400 transition-colors"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      </section>

      {/* Estados de carga / error / vacío */}
      {cargando && <p className="empty-note">Cargando datos de la base de datos...</p>}
      {error && (
        <p className="empty-note" style={{ color: "var(--danger-text)" }}>
          {error}
        </p>
      )}
      {!cargando && !error && resultados.length === 0 && (
        <p className="empty-note">No se encontraron acciones de mejora que coincidan.</p>
      )}

      {/* Lista de tarjetas */}
      {!cargando && !error && visibles.length > 0 && (
        <section className="space-y-3.5">
          {visibles.map((r, i) => {
            const codigo = obtenerNumeroAccion(r);
            const area = obtenerArea(r);
            const estado = r.estado || "Pendiente";
            const est = ESTADO_STYLE[estado] || ESTADO_DEFAULT;
            const descripcion = obtenerDescripcion(r) || "Sin descripción registrada";
            const categoriaTexto = r.categoria
              ? `${r.categoria}${r.subcategoria ? " / " + r.subcategoria : ""}`
              : null;

            return (
              <article
                key={r.id || codigo}
                style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
                className="animate-card group relative p-5 rounded-2xl bg-dark-card hover:bg-dark-cardHover border border-dark-border hover:border-slate-700 transition-all duration-200 shadow-lg hover:shadow-2xl hover:-translate-y-0.5"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0 pr-4">
                    <div className="flex items-center flex-wrap gap-3">
                      <span className="font-mono text-sm font-bold text-brand-500 tracking-tight group-hover:text-brand-400 transition-colors">
                        {codigo}
                      </span>

                      {area && (
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${estiloArea(
                            area
                          )}`}
                        >
                          Área: {area}
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${est.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />
                        {estado}
                      </span>
                    </div>

                    <h2 className="m-0 text-sm font-medium text-slate-200 leading-relaxed line-clamp-3">
                      {descripcion}
                    </h2>

                    {(r.solicitante || categoriaTexto) && (
                      <p className="m-0 text-[11px] text-slate-400">
                        {r.solicitante ? `Solicitante: ${r.solicitante}` : ""}
                        {r.solicitante && categoriaTexto ? " · " : ""}
                        {categoriaTexto ? `Categoría: ${categoriaTexto}` : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0 self-end md:self-start md:pt-1">
                    <button
                      type="button"
                      onClick={() => onVerAccion && onVerAccion(r)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-slate-500 transition-all duration-150"
                    >
                      <Eye size={14} className="text-slate-400" />
                      Abrir
                    </button>

                    {esAdmin && (
                      <button
                        type="button"
                        onClick={() => onEditarAccion && onEditarAccion(r)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-orange-500 border-0 shadow-md hover:shadow-brand-500/25 transition-all duration-150 active:scale-95"
                      >
                        <Edit3 size={14} />
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Paginación */}
      {!cargando && !error && resultados.length > 0 && (
        <footer className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-dark-border text-xs text-slate-400">
          <div>
            Mostrando <span className="font-medium text-slate-200">{inicio + 1}</span> a{" "}
            <span className="font-medium text-slate-200">
              {Math.min(inicio + POR_PAGINA, resultados.length)}
            </span>{" "}
            de <span className="font-medium text-slate-200">{resultados.length}</span> resultados
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={paginaActual <= 1}
              onClick={() => setPagina(paginaActual - 1)}
              className="p-2 rounded-lg bg-dark-card border border-dark-border text-slate-300 hover:border-slate-500 disabled:text-slate-600 disabled:cursor-not-allowed disabled:hover:border-dark-border"
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="min-w-[2rem] h-8 px-2 rounded-lg bg-brand-500 text-white font-semibold flex items-center justify-center text-xs shadow-sm">
              {paginaActual} / {totalPaginas}
            </span>

            <button
              type="button"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPagina(paginaActual + 1)}
              className="p-2 rounded-lg bg-dark-card border border-dark-border text-slate-300 hover:border-slate-500 disabled:text-slate-600 disabled:cursor-not-allowed disabled:hover:border-dark-border"
              aria-label="Página siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function Chip({ children, onQuitar }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 border border-brand-500/25 text-brand-400 text-[11px]">
      <span>{children}</span>
      <button
        type="button"
        title="Quitar filtro"
        onClick={onQuitar}
        className="bg-transparent border-0 p-0 leading-none text-brand-400 hover:text-white"
      >
        ×
      </button>
    </span>
  );
}