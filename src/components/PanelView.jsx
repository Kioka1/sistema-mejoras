import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpRight, CheckCheck, ClipboardList, Clock3, RefreshCw, ShieldAlert, Target } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { fetchAcciones } from "../api.js";
import { indicadores } from "../dashboard.js";
import { nombreEstado } from "../estados.js";
import { fechaBolivia } from "./PlazoEntrega.jsx";

const tooltip = { background: "#16223b", border: "1px solid #334155", borderRadius: 12, color: "#eef1f6" };

export default function PanelView({ usuario, onAbrirAccion }) {
  const [acciones, setAcciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actualizado, setActualizado] = useState(null);
  const [sede, setSede] = useState("");
  const [area, setArea] = useState("");
  const cargar = async () => {
    setLoading(true); setError("");
    try {
      const lista = await fetchAcciones();
      if (!Array.isArray(lista)) throw new Error();
      setAcciones(lista); setActualizado(new Date());
    } catch { setError("No se pudieron actualizar los indicadores. Intenta nuevamente."); }
    finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);
  const sedes = [...new Set(acciones.map((a) => a.sede).filter(Boolean))].sort();
  const areasDe = (a) => a.areas?.length ? a.areas : [a.area_responsable || a.procesos || "Sin área"];
  const areas = [...new Set(acciones.filter((a) => !sede || a.sede === sede).flatMap(areasDe))].sort();
  const filtradas = useMemo(() => acciones.filter((a) => (!sede || a.sede === sede) && (!area || areasDe(a).includes(area))), [acciones, sede, area]);
  const m = indicadores(filtradas, fechaBolivia());
  const tarjetas = [
    { titulo: "Total de acciones", valor: m.total, detalle: `${m.abiertas} abiertas en seguimiento`, icono: ClipboardList, tono: "blue" },
    { titulo: "Acciones cerradas", valor: m.cerradas, detalle: `${m.porcentaje}% del total registrado`, icono: CheckCheck, tono: "green" },
    { titulo: "Plazos vencidos", valor: m.vencidas, detalle: "Requieren atención prioritaria", icono: ShieldAlert, tono: "rose" },
    { titulo: "Próximas a vencer", valor: m.proximas, detalle: "Hasta 2 días hábiles de plazo", icono: Clock3, tono: "amber" },
  ];
  return <div className="dashboard" aria-busy={loading}>
    <div className="dashboard-heading">
      <div><span className="dashboard-eyebrow"><Activity size={14} /> SEGUIMIENTO DE MEJORAS</span>
        <h1>Panel de control</h1><p>{usuario?.rol === "admin" ? "Una visión general para tomar decisiones y dar seguimiento." : "El avance y las prioridades de las acciones de tus áreas."}</p></div>
      <button className="dashboard-refresh" onClick={cargar} disabled={loading}><RefreshCw size={15} className={loading ? "dashboard-spin" : ""} />{loading ? "Actualizando…" : "Actualizar"}</button>
    </div>
    <div className="dashboard-filters">
      <label>Sede<select value={sede} onChange={(e) => { setSede(e.target.value); setArea(""); }}><option value="">Todas las sedes</option>{sedes.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Área responsable<select value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas las áreas</option>{areas.map((a) => <option key={a}>{a}</option>)}</select></label>
      <span className="dashboard-updated" role="status">{actualizado ? `Actualizado a las ${actualizado.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" })}` : "Cargando indicadores…"}</span>
    </div>
    {error && <div className="dashboard-error" role="alert">{error}</div>}
    {actualizado && <>
      <div className="dashboard-kpis">{tarjetas.map(({ titulo, valor, detalle, icono: Icono, tono }) => <article className={`dashboard-kpi tone-${tono}`} key={titulo}>
        <div className="dashboard-kpi-top"><span>{titulo}</span><span className="dashboard-icon"><Icono size={19} /></span></div>
        <strong>{valor}</strong><small>{detalle}</small>
      </article>)}</div>
      {!m.total && <p className="dashboard-empty">No hay acciones para los filtros seleccionados.</p>}
      <div className="dashboard-grid">
        <section className="dashboard-card"><div className="dashboard-card-heading"><div><h2>Evolución de acciones</h2><p>Registros y cierres en los últimos 6 meses</p></div><span className="dashboard-chip">Mensual</span></div>
          <ResponsiveContainer width="100%" height={255}><AreaChart data={m.meses} margin={{ top: 12, right: 12, left: -25, bottom: 0 }}>
            <defs><linearGradient id="dashboard-registros" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} /><stop offset="100%" stopColor="#818cf8" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="#263249" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="mes" tick={{ fill: "#9aa4b5", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#9aa4b5", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltip} /><Legend wrapperStyle={{ fontSize: 12 }} /><Area type="monotone" dataKey="registradas" name="Registradas" stroke="#818cf8" fill="url(#dashboard-registros)" strokeWidth={2.5} /><Area type="monotone" dataKey="cerradas" name="Cerradas" stroke="#34d399" fill="transparent" strokeWidth={2.5} />
          </AreaChart></ResponsiveContainer>
        </section>
        <section className="dashboard-card"><div className="dashboard-card-heading"><div><h2>Distribución por estado</h2><p>Situación actual de las acciones</p></div></div>
          {m.total ? <><div className="dashboard-donut"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={m.estados} dataKey="cantidad" nameKey="estado" innerRadius={62} outerRadius={82} paddingAngle={3} stroke="none">{m.estados.map((e) => <Cell key={e.estado} fill={e.color} />)}</Pie><Tooltip contentStyle={tooltip} /></PieChart></ResponsiveContainer><div className="dashboard-donut-label"><strong>{m.total}</strong><span>acciones</span></div></div>
            <div className="dashboard-legend">{m.estados.map((e) => <div key={e.estado}><span className="dashboard-dot" style={{ background: e.color }} /><span>{e.estado}</span><b>{e.cantidad}</b></div>)}</div></> : <p className="dashboard-empty">Sin estados para mostrar</p>}
        </section>
        <section className="dashboard-card"><div className="dashboard-card-heading"><div><h2>Acciones por área</h2><p>Las 6 áreas con mayor volumen</p></div><span className="dashboard-chip">{m.areas.length} áreas</span></div>
          <div className="dashboard-area-list">{m.areas.slice(0, 6).map((a, i) => <div key={a.area}><div><span><em>{String(i + 1).padStart(2, "0")}</em>{a.area}</span><b>{a.cantidad}</b></div><div className="dashboard-track"><span style={{ width: `${a.cantidad / m.areas[0].cantidad * 100}%` }} /></div></div>)}</div>
          {!m.areas.length && <p className="dashboard-empty">Sin áreas para mostrar</p>}<p className="dashboard-footnote">Una acción con varias áreas cuenta en cada una.</p>
        </section>
        <section className="dashboard-card"><div className="dashboard-card-heading"><div><h2>Avance y pendientes</h2><p>Estado del flujo de trabajo</p></div><Target size={20} className="dashboard-muted" /></div>
          <div className="dashboard-progress"><strong>{m.porcentaje}<small>%</small></strong><span>de acciones cerradas</span></div><div className="dashboard-track dashboard-track-green" role="progressbar" aria-label="Porcentaje de acciones cerradas" aria-valuenow={m.porcentaje} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${m.porcentaje}%` }} /></div>
          <div className="dashboard-workflow">{[["Formularios por completar / corregir", m.formularios], ["Pendientes de evidencia", m.evidencia], ["Pendientes de verificación", m.verificacion]].map(([titulo, valor]) => <div key={titulo}><span>{titulo}</span><b>{valor}</b></div>)}</div>
          <p className="dashboard-footnote">Los vencimientos se calculan con los plazos de seguimiento activos.</p>
        </section>
      </div>
      <section className="dashboard-card dashboard-priorities"><div className="dashboard-card-heading"><div><h2>Acciones que requieren atención</h2><p>Primero los plazos vencidos, luego los próximos y las verificaciones</p></div><span className="dashboard-chip">{m.prioridades.length} acciones</span></div>
        {m.prioridades.length ? <><div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>Acción / hallazgo</th><th>Área</th><th>Estado</th><th>Prioridad / plazo</th><th><span className="sr-only">Abrir</span></th></tr></thead><tbody>{m.prioridades.slice(0, 6).map((a) => <tr key={a.id}>
          <td><b>{a.numero_ac_original || a.numero}</b><span className="dashboard-finding">{a.declaracion_hallazgo || "Sin descripción"}</span></td><td>{areasDe(a).join(", ")}</td><td>{nombreEstado(a.estado)}</td><td><span className={`dashboard-priority priority-${a.alerta_plazo?.nivel || "revision"}`}>{a.alerta_plazo?.texto || "Por verificar"}</span>{a.alerta_plazo && <small>{a.alerta_plazo.tipo} · {a.alerta_plazo.fecha}</small>}</td><td><button className="dashboard-open" onClick={() => onAbrirAccion(a)} aria-label={`Abrir acción ${a.numero_ac_original || a.numero}`}><ArrowUpRight size={18} /></button></td>
        </tr>)}</tbody></table></div>{m.prioridades.length > 6 && <p className="dashboard-footnote">Se muestran las primeras 6 acciones de mayor prioridad.</p>}</> : <p className="dashboard-empty">No hay plazos vencidos, próximos a vencer ni verificaciones pendientes.</p>}
      </section>
    </>}
  </div>;
}
