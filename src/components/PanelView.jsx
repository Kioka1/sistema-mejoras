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
import { fetchAcciones, fetchRegistros, fetchSolicitudes } from "../api.js";

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
  Cerrada: "#4ade9a",
  Pendiente: "#e8672f",
  "En revisión": "#f0b429",
  Resuelto: "#4ade9a",
  Respondida: "#3b82c4",
  Nuevo: "#a855f7",
};

export default function PanelView() {
  const [metrics, setMetrics] = useState({
    total: 0,
    incidencias: 0,
    mejoras: 0,
    pendientes: 0,
    porSistema: [],
    porEstado: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatosReales() {
      setLoading(true);
      try {
        const [accionesData, registrosData, solicitudesData] = await Promise.allSettled([
          fetchAcciones(),
          fetchRegistros ? fetchRegistros() : Promise.resolve([]),
          fetchSolicitudes ? fetchSolicitudes() : Promise.resolve([]),
        ]);

        const acciones = accionesData.status === "fulfilled" && Array.isArray(accionesData.value) ? accionesData.value : [];
        const registros = registrosData.status === "fulfilled" && Array.isArray(registrosData.value) ? registrosData.value : [];
        const solicitudes = solicitudesData.status === "fulfilled" && Array.isArray(solicitudesData.value) ? solicitudesData.value : [];

        const totalMejoras = acciones.length;
        const totalIncidencias = registros.length + solicitudes.length;
        const totalRegistros = totalMejoras + totalIncidencias;

        const pendientesAcciones = acciones.filter((a) => a.estado !== "Cerrada").length;
        const pendientesRegistros = registros.filter((r) => r.estado && !["Resuelto", "Cerrado", "Cerrada"].includes(r.estado)).length;
        const pendientesSolicitudes = solicitudes.filter((s) => s.estado && !["Resuelto", "Cerrado", "Cerrada"].includes(s.estado)).length;
        const totalPendientes = pendientesAcciones + pendientesRegistros + pendientesSolicitudes;

        // Distribución por Sistema / Proceso
        const sistemasMap = {};

        acciones.forEach((a) => {
          const sistema = a.procesos || a.area_responsable || "SGC / Gestión";
          sistemasMap[sistema] = (sistemasMap[sistema] || 0) + 1;
        });

        registros.forEach((r) => {
          const sistema = r.sistema || r.proceso || "Operación";
          sistemasMap[sistema] = (sistemasMap[sistema] || 0) + 1;
        });

        solicitudes.forEach((s) => {
          const sistema = s.sistema || s.modulo || "Atención";
          sistemasMap[sistema] = (sistemasMap[sistema] || 0) + 1;
        });

        const porSistema = Object.keys(sistemasMap).map((key) => ({
          sistema: key,
          cantidad: sistemasMap[key],
        }));

        // Distribución por Estado
        const estadosMap = {};
        [...acciones, ...registros, ...solicitudes].forEach((item) => {
          const estado = item.estado || "Pendiente";
          estadosMap[estado] = (estadosMap[estado] || 0) + 1;
        });

        const porEstado = Object.keys(estadosMap).map((key) => ({
          estado: key,
          cantidad: estadosMap[key],
        }));

        setMetrics({
          total: totalRegistros,
          incidencias: totalIncidencias,
          mejoras: totalMejoras,
          pendientes: totalPendientes,
          porSistema,
          porEstado,
        });
      } catch (e) {
        console.error("Error al procesar indicadores:", e);
      } finally {
        setLoading(false);
      }
    }

    cargarDatosReales();
  }, []);

  if (loading) return <p className="empty-note">Cargando indicadores en tiempo real...</p>;

  return (
    <div>
      <div className="metrics-row">
        <div className="metric-card">
          <div className="num">{metrics.total}</div>
          <div className="lbl">Total registros</div>
        </div>
        <div className="metric-card">
          <div className="num">{metrics.incidencias}</div>
          <div className="lbl">Incidencias</div>
        </div>
        <div className="metric-card">
          <div className="num">{metrics.mejoras}</div>
          <div className="lbl">Mejoras</div>
        </div>
        <div className="metric-card">
          <div className="num">{metrics.pendientes}</div>
          <div className="lbl">Pendientes</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <p className="chart-title" style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: "16px" }}>Registros por sistema / proceso</p>
          {metrics.porSistema.length === 0 ? (
            <p className="empty-note">No hay datos disponibles</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics.porSistema}>
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
          <p className="chart-title" style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: "16px" }}>Registros por estado</p>
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