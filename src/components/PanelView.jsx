import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { fetchAcciones } from "../api.js";

const PALETA_COLORES = [
  "#e8672f",
  "#f0b429",
  "#4ade9a",
  "#3b82c4",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

const ESTADO_MAP = {
  "Pendiente Plan de Acción": "#e8672f",
  "Pendiente Verificación": "#f0b429",
  Observada: "#f0625f",
  Cerrada: "#4ade9a",
};

export default function PanelView() {
  const [metrics, setMetrics] = useState({
    total: 0,
    pendientesPlan: 0,
    enVerificacion: 0,
    cerradas: 0,
    porArea: [],
    porEstado: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);
      try {
        const data = await fetchAcciones();
        const acciones = Array.isArray(data) ? data : [];

        const contar = (fn) => acciones.filter(fn).length;
        const agrupar = (clave) => {
          const mapa = {};
          acciones.forEach((a) => {
            const k = clave(a);
            mapa[k] = (mapa[k] || 0) + 1;
          });
          return mapa;
        };

        const porAreaMapa = agrupar((a) => (a.area_responsable || a.procesos || "Sin área").trim());
        const porEstadoMapa = agrupar((a) => a.estado || "Pendiente Plan de Acción");

        setMetrics({
          total: acciones.length,
          pendientesPlan: contar((a) => ["Pendiente Plan de Acción", "Observada"].includes(a.estado)),
          enVerificacion: contar((a) => a.estado === "Pendiente Verificación"),
          cerradas: contar((a) => a.estado === "Cerrada"),
          porArea: Object.keys(porAreaMapa).map((k) => ({ sistema: k, cantidad: porAreaMapa[k] })),
          porEstado: Object.keys(porEstadoMapa).map((k) => ({ estado: k, cantidad: porEstadoMapa[k] })),
        });
      } catch (e) {
        console.error("Error al procesar indicadores:", e);
      } finally {
        setLoading(false);
      }
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="empty-note">Cargando indicadores en tiempo real...</p>;

  return (
    <div>
      <div className="metrics-row">
        <div className="metric-card">
          <div className="num">{metrics.total}</div>
          <div className="lbl">Total acciones</div>
        </div>
        <div className="metric-card">
          <div className="num">{metrics.pendientesPlan}</div>
          <div className="lbl">Pendientes de plan</div>
        </div>
        <div className="metric-card">
          <div className="num">{metrics.enVerificacion}</div>
          <div className="lbl">En verificación</div>
        </div>
        <div className="metric-card">
          <div className="num">{metrics.cerradas}</div>
          <div className="lbl">Cerradas</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <p className="chart-title" style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: "16px" }}>Acciones por área / proceso</p>
          {metrics.porArea.length === 0 ? (
            <p className="empty-note">No hay datos disponibles</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics.porArea}>
                <XAxis dataKey="sistema" tick={{ fontSize: 11, fill: "#9aa4b5" }} axisLine={{ stroke: "#2a3444" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9aa4b5" }} axisLine={{ stroke: "#2a3444" }} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(59, 130, 196, 0.12)" }}
                  contentStyle={{ background: "#1e2837", border: "1px solid #2a3444", borderRadius: "8px", color: "#eef1f6" }}
                />
                <Bar dataKey="cantidad" fill="#3b82c4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-card">
          <p className="chart-title" style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: "16px" }}>Acciones por estado</p>
          {metrics.porEstado.length === 0 ? (
            <p className="empty-note">No hay datos disponibles</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={metrics.porEstado}
                  dataKey="cantidad"
                  nameKey="estado"
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  label={false}
                  labelLine={false}
                >
                  {metrics.porEstado.map((entry, i) => (
                    <Cell
                      key={`cell-${i}`}
                      fill={ESTADO_MAP[entry.estado] || PALETA_COLORES[i % PALETA_COLORES.length]}
                      stroke="#1e2837"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e2837", border: "1px solid #2a3444", borderRadius: "8px", color: "#eef1f6" }} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", color: "#9aa4b5", paddingTop: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}