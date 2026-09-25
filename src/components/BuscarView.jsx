import { useState, useEffect } from "react";
import { fetchAcciones } from "../api";
import { Eye, Edit3 } from "lucide-react";

export default function BuscarView({ usuario, onVerAccion, onEditarAccion }) {
  const esAdmin = usuario?.rol === "admin";
  const [query, setQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [acciones, setAcciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarDatosReales();
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

  const obtenerNumeroAccion = (item) => {
    if (item.numero_ac_original) return item.numero_ac_original;
    if (item.numero_accion) return item.numero_accion;
    const num = String(item.id || 1).padStart(2, "0");
    return `AM BS-EA-${num}-26`;
  };

  const q = query.toLowerCase().trim();
  const resultados = acciones.filter((item) => {
    const numAccion = obtenerNumeroAccion(item).toLowerCase();
    const hallazgo = (item.hallazgo_asunto || item.hallazgo || item.declaracion_hallazgo || "").toLowerCase();
    const area = (item.area_responsable || item.procesos || "").toLowerCase();
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

    const coincideEstado =
      !filtroEstado || estadoItem === filtroEstado.toLowerCase();

    return coincideTexto && coincideEstado;
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Buscar</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          className="text-input"
          style={{ flex: 1 }}
          placeholder="Buscar por código, hallazgo, área, categoría..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select
          className="text-input"
          style={{ width: 260, cursor: "pointer" }}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="Pendiente Plan de Acción">Pendiente Plan de Acción</option>
          <option value="Pendiente Verificación">Pendiente Verificación</option>
          <option value="Cerrada">Cerrada</option>
        </select>
      </div>

      {cargando && <p className="empty-note">Cargando datos de la base de datos...</p>}
      {error && <p className="empty-note" style={{ color: "var(--danger-text)" }}>{error}</p>}

      {!cargando && !error && resultados.length === 0 && (
        <p className="empty-note">No se encontraron acciones de mejora que coincidan.</p>
      )}

      {!cargando &&
        !error &&
        resultados.map((r) => {
          const codigoVisual = obtenerNumeroAccion(r);
          const area = r.area_responsable || r.procesos || "Sin Área";
          const estado = r.estado || "Pendiente";
          const descripcion = r.hallazgo_asunto || r.hallazgo || r.declaracion_hallazgo || "Sin descripción registrada";
          const categoriaTexto = r.categoria ? `${r.categoria}${r.subcategoria ? " / " + r.subcategoria : ""}` : null;

          return (
            <div className="card" key={r.id || codigoVisual} style={{ marginBottom: 12, padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                    <span className="mono" style={{ color: "var(--accent)", marginRight: 10, fontWeight: 700 }}>
                      {codigoVisual}
                    </span>
                    {descripcion}
                  </p>

                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
                    Área: <strong>{area}</strong> · Estado: <span style={{ color: "var(--text-primary)" }}>{estado}</span>
                    {r.solicitante ? ` · Solicitante: ${r.solicitante}` : ""}
                    {categoriaTexto ? ` · Categoría: ${categoriaTexto}` : ""}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    className="btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13 }}
                    onClick={() => onVerAccion && onVerAccion(r)}
                  >
                    <Eye size={15} />
                    Abrir
                  </button>

                  {esAdmin && (
                    <button
                      className="btn-primary"
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13 }}
                      onClick={() => onEditarAccion && onEditarAccion(r)}
                    >
                      <Edit3 size={15} />
                      Editar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}