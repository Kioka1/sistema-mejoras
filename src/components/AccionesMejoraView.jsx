import { nombreEstado } from "../estados.js";
import PlazoEntrega, { fechaBolivia, sumarHabiles } from "./PlazoEntrega.jsx";
import AlertaPlazo, { IndicadorEstado, claseBadge, claseAlerta, fechaVencimiento } from "./AlertaPlazo.jsx";
import PlanAccionForm from "./PlanAccionForm.jsx";
import FormularioImpresion from "./FormularioImpresion.jsx";
import EvidenciasCard from "./EvidenciasCard.jsx";
import { useEffect, useState } from "react";
import { ClipboardCheck, ChevronLeft, Download, Upload, Pencil, Eye } from "lucide-react";
import {
  fetchAcciones,
  fetchAreas,
  fetchRecomendaciones,
  crearLoteAcciones,
  enviarObservacion,
  completarVerificacion,
  urlExportarAcciones,
  importarExcelAcciones,
  editarAccion,
  urlFormularioHistorico,
  cambiarSeguimientoHistorico,
} from "../api.js";

const estadoPill = {
  "Pendiente Plan de Acción": "pill-formulario",
  "Pendiente Verificación": "pill-verificacion",
  "En ejecución": "pill-verif",
  "Pendiente de evidencia": "pill-evidencia",
  Observada: "pill-nuevo",
  Cerrada: "pill-cerrada",
};

const ROLES = ["Sistemas de Gestión (calidad)", "Área Responsable"];

export default function AccionesMejoraView({
  usuario,
  accionInicial = null,
  modoInicial = "ver",
  onClearAccionInicial,
}) {
  const rol = usuario.rol === "admin" ? "Sistemas de Gestión (calidad)" : "Área Responsable";
  const [acciones, setAcciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccionada, setSeleccionada] = useState(null);
  const [editando, setEditando] = useState(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [recomendaciones, setRecomendaciones] = useState([]);

  const cargar = () => {
    fetchRecomendaciones().then(setRecomendaciones).catch(() => setRecomendaciones([]));
    setLoading(true);
    fetchAcciones()
      .then((data) => {
        // Ordenar descendentemente por id para que los nuevos aparezcan primero
        const ordenadas = Array.isArray(data) ? data.sort((a, b) => b.id - a.id) : [];
        setAcciones(ordenadas);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
    const actualizar = () => fetchAcciones().then((lista) => setAcciones(Array.isArray(lista) ? lista : [])).catch(() => {});
    const alVolver = () => document.visibilityState === "visible" && actualizar();
    const timer = setInterval(actualizar, 60000);
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("entregas-actualizadas", actualizar);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("entregas-actualizadas", actualizar);
    };
  }, []);

  useEffect(() => {
    if (accionInicial) {
      if (modoInicial === "editar") {
        setEditando(accionInicial);
        setSeleccionada(null);
      } else {
        setSeleccionada(accionInicial);
        setEditando(null);
      }
      setMostrarNueva(false);
    }
  }, [accionInicial, modoInicial]);

  const abrir = (accion) => {
    setSeleccionada(accion);
    setEditando(null);
    setMostrarNueva(false);
  };

  const volver = () => {
    setSeleccionada(null);
    setEditando(null);
    if (onClearAccionInicial) onClearAccionInicial();
    cargar();
  };

  const toggleSeleccion = (id) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (mostrarNueva) {
    return (
      <NuevaSolicitudForm
        onCancel={() => setMostrarNueva(false)}
        onCreated={() => {
          setMostrarNueva(false);
          cargar();
        }}
      />
    );
  }

  if (editando) {
    return <EditarRegistroForm accion={editando} onCancel={volver} onSaved={volver} />;
  }

  if (seleccionada) {
    return <DetalleAccion id={seleccionada.id} rol={rol} onBack={volver} />;
  }

  return (
    <div>
                  <div className="role-switch">
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Estás viendo como:</span>
        <span className="pill pill-verif">{rol}</span>
      </div>

      {rol === "Sistemas de Gestión (calidad)" && (
        <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => setMostrarNueva(true)}>
          + Nueva solicitud (Buzón de Sugerencias)
        </button>
      )}

      {rol === "Sistemas de Gestión (calidad)" && (
        <>
          <ExportarPanel seleccionadas={seleccionadas} />
          <ImportarPanel onImportado={cargar} />
        </>
      )}

      <RecomendacionesPanel items={recomendaciones} esAdmin={rol === "Sistemas de Gestión (calidad)"} />

      {loading && <p className="empty-note">Cargando...</p>}

      {!loading && acciones.length === 0 && (
        <p className="empty-note">
          {rol === "Sistemas de Gestión (calidad)"
            ? "Todavía no hay Acciones de Mejora registradas."
            : "No tienes Acciones de Mejora asignadas por ahora."}
        </p>
      )}

      {!loading && acciones.length > 0 && (
        <div className="ticket-table-wrap">
          <table className="ticket-table">
            <thead>
              <tr>
                <th className="col-check"></th>
                <th>Código</th><th>Área</th><th>Estado</th>
                <th>Fecha de creación</th><th>Fecha de vencimiento</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {acciones.map((a) => {
                const alerta = a.alerta_plazo;
                const codigoMostrar = a.numero_ac_original || a.numero_accion || a.numero;

                return (
                  <tr key={a.id} className={claseAlerta(alerta, a.estado)}>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(a.id)}
                        onChange={() => toggleSeleccion(a.id)}
                      />
                    </td>
                    <td className="mono" onClick={() => abrir(a)} style={{ cursor: "pointer" }}>{codigoMostrar}</td>
                    <td onClick={() => abrir(a)} style={{ cursor: "pointer" }}>{(a.areas || []).join(" / ") || a.area_responsable || "—"}</td>
                    <td onClick={() => abrir(a)} style={{ cursor: "pointer" }}>
                      <span className={`pill ${estadoPill[a.estado] || "pill-plan"} ${claseBadge(a.estado)}`}><IndicadorEstado estado={a.estado} />{nombreEstado(a.estado)}</span>
                      <AlertaPlazo alerta={alerta} />
                    </td>
                    <td onClick={() => abrir(a)} style={{ cursor: "pointer" }}>{a.fecha_creacion || "—"}</td>
                    <td onClick={() => abrir(a)} style={{ cursor: "pointer" }}>{fechaVencimiento(a) || "—"}</td>
                    <td className="col-actions">
                      <button className="icon-btn" title="Ver documento completo" onClick={(e) => { e.stopPropagation(); abrir(a); }}>
                        <Eye size={15} />
                      </button>
                      {rol === "Sistemas de Gestión (calidad)" && (
                        <button className="icon-btn" title="Editar campos" onClick={(e) => { e.stopPropagation(); setEditando(a); }}>
                          <Pencil size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecomendacionesPanel({ items, esAdmin }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p className="stage-title" style={{ marginTop: 0 }}>Recomendaciones del Buzón de Sugerencias</p>
      {items.map((r) => (
        <div className="timeline-item" key={r.id} style={{ alignItems: "flex-start" }}>
          <span>{r.fecha}</span>
          <span>—</span>
          <span>
            {esAdmin && <b>[{r.area}] </b>}
            {r.texto}
          </span>
        </div>
      ))}
    </div>
  );
}

function NuevaSolicitudForm({ onCancel, onCreated }) {
  const [areas, setAreas] = useState([]);
  const [cargandoAreas, setCargandoAreas] = useState(true);
  const [area, setArea] = useState("");
  const [plazo, setPlazo] = useState(() => sumarHabiles(fechaBolivia(), 10));
  const [solicitante, setSolicitante] = useState("");
  const [procesos, setProcesos] = useState("");
  const [hallazgos, setHallazgos] = useState([""]);
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    fetchAreas()
      .then((lista) => {
        setAreas(lista);
        if (lista.length === 1) setArea(lista[0]);
      })
      .catch(() => setError("No se pudieron cargar las áreas"))
      .finally(() => setCargandoAreas(false));
  }, []);

  const cambiar = (lista, setLista, i, valor) => setLista(lista.map((x, idx) => (idx === i ? valor : x)));
  const quitar = (lista, setLista, i) => setLista(lista.filter((_, idx) => idx !== i));

  const enviar = async () => {
    if (!area) {
      setError("Elige el área o carrera destinataria");
      return;
    }
    const hs = hallazgos.map((h) => h.trim()).filter(Boolean);
    const rs = recomendaciones.map((r) => r.trim()).filter(Boolean);
    if (hs.length === 0 && rs.length === 0) {
      setError("Agrega al menos una acción de mejora o una recomendación");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      const r = await crearLoteAcciones({
        area,
        plazo_entrega_plan: plazo || null,
        solicitante: solicitante.trim() || null,
        procesos: procesos.trim() || null,
        hallazgos: hs,
        recomendaciones: rs,
      });
      setResultado(r);
    } catch (e) {
      setError(e.message || "No se pudo enviar la solicitud");
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <div className="card">
        <p className="stage-title" style={{ marginTop: 0 }}>Solicitud enviada a {area}</p>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Se envió <b>un solo correo</b> al área con todo el detalle.
        </p>
        {resultado.acciones.length > 0 && (
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Acciones de Mejora creadas:{" "}
            {resultado.acciones.map((a) => (
              <span key={a.id} className="mono" style={{ marginRight: 10, color: "var(--accent)" }}>{a.numero}</span>
            ))}
          </p>
        )}
        {resultado.recomendaciones > 0 && (
          <p style={{ fontSize: 14 }}>Recomendaciones enviadas: {resultado.recomendaciones}</p>
        )}
        <button className="btn-primary" onClick={onCreated}>Volver a la lista</button>
      </div>
    );
  }

  return (
    <div>
      <button className="back-link" onClick={onCancel}>
        <ChevronLeft size={14} style={{ verticalAlign: -2 }} /> Cancelar
      </button>
      <div className="stage-section active-stage">
        <p className="stage-title">Nueva solicitud — Buzón de Sugerencias (BS)</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0 }}>
          Cada acción de mejora recibe su código correlativo (AM BS-NN-AA). El área recibe todo en un solo correo.
        </p>

        <div className="grid-2">
          <div>
            <label className="field-label">Proceso(s)</label>
            <input className="text-input" style={{ marginBottom: 12 }} value={procesos} onChange={(e) => setProcesos(e.target.value)} />
            <label className="field-label">Área / Carrera destinataria</label>
            <select className="text-input" value={area} onChange={(e) => setArea(e.target.value)} disabled={cargandoAreas}>
              <option value="">{cargandoAreas ? "Cargando..." : "— Elige un área —"}</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {!cargandoAreas && areas.length === 0 && (
              <span style={{ fontSize: 12, color: "var(--danger-text)" }}>
                Aún no hay usuarios con área asignada. Créalos en la pestaña Usuarios.
              </span>
            )}
          </div>
          <div>
            <PlazoEntrega value={plazo} onChange={setPlazo} />
          </div>
        </div>

        <div style={{ marginTop: 12, maxWidth: 420 }}>
          <label className="field-label">Solicitante (opcional)</label>
          <input className="text-input" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} />
        </div>

        <p className="stage-title" style={{ marginTop: 20 }}>Acciones de mejora</p>
        {hallazgos.map((h, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
            <textarea
              className="text-input"
              rows={3}
              placeholder={`Hallazgo / queja ${i + 1}`}
              value={h}
              onChange={(e) => cambiar(hallazgos, setHallazgos, i, e.target.value)}
            />
            {hallazgos.length > 1 && (
              <button className="icon-btn" title="Quitar" onClick={() => quitar(hallazgos, setHallazgos, i)}>✕</button>
            )}
          </div>
        ))}
        <button className="btn-primary" style={{ background: "transparent", border: "1px solid var(--border-soft)", color: "var(--text-primary)" }} onClick={() => setHallazgos([...hallazgos, ""])}>
          + Agregar otra acción de mejora
        </button>

        <p className="stage-title" style={{ marginTop: 20 }}>Recomendaciones (solo para conocimiento del área)</p>
        {recomendaciones.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
            <textarea
              className="text-input"
              rows={2}
              placeholder={`Recomendación ${i + 1}`}
              value={r}
              onChange={(e) => cambiar(recomendaciones, setRecomendaciones, i, e.target.value)}
            />
            <button className="icon-btn" title="Quitar" onClick={() => quitar(recomendaciones, setRecomendaciones, i)}>✕</button>
          </div>
        ))}
        <button className="btn-primary" style={{ background: "transparent", border: "1px solid var(--border-soft)", color: "var(--text-primary)" }} onClick={() => setRecomendaciones([...recomendaciones, ""])}>
          + Agregar recomendación
        </button>

        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-primary" onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar solicitud al área"}
          </button>
          {error && <span style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

const ESTADOS_EDICION = ["Pendiente Plan de Acción", "Observada", "En ejecución", "Pendiente de evidencia", "Pendiente Verificación", "Cerrada"];

function EditarRegistroForm({ accion, onCancel, onSaved }) {
  const [form, setForm] = useState({
    declaracion_hallazgo: accion.declaracion_hallazgo || accion.hallazgo || "",
    fuente_identificacion: accion.fuente_identificacion || accion.origen || "",
    procesos: accion.procesos || "",
    solicitante: accion.solicitante || "",
    area_responsable: accion.area_responsable || "",
    sede: accion.sede || "",
    numero_ac_original: accion.numero_ac_original || accion.numero_accion || accion.numero || "",
    estado: accion.estado || "Pendiente Plan de Acción",
    requiere_cambio_sgc: accion.requiere_cambio_sgc || accion.cambio_sgc || "",
    plazo_entrega_plan: accion.plazo_entrega_plan || accion.plazo_plan || "",
    plazo_ejecucion: accion.plazo_ejecucion || "",
    fecha_cierre_plan: accion.fecha_cierre_plan || accion.fecha_cierre || "",
    observacion: accion.observacion || "",
    informe_investigacion: accion.informe_investigacion || "",
    analisis_causa_raiz: accion.analisis_causa_raiz || "",
    correccion_inmediata: accion.correccion_inmediata || "",
    plan_accion: accion.plan_accion || "",
    responsables: accion.responsables || "",
    descripcion_verificacion: accion.descripcion_verificacion || "",
    conclusion: accion.conclusion || "",
    coordinador_sistemas_gestion: accion.coordinador_sistemas_gestion || "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const campo = (label, field, opts = {}) => (
    <div style={opts.full ? { gridColumn: "1 / -1" } : undefined}>
      <label className="field-label">{label}</label>
      {opts.textarea ? (
        <textarea className="text-input" rows={opts.rows || 3} value={form[field]} onChange={set(field)} />
      ) : (
        <input className="text-input" type={opts.type || "text"} value={form[field]} onChange={set(field)} />
      )}
    </div>
  );

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      await editarAccion(accion.id, form);
      onSaved();
    } catch (e) {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <button className="back-link" onClick={onCancel}>
        <ChevronLeft size={14} style={{ verticalAlign: -2 }} /> Cancelar
      </button>

      <div className="stage-section active-stage">
        <p className="stage-title">Editar Registro #{accion.id}</p>

        <p className="stage-title" style={{ fontSize: 12 }}>Encabezado General</p>
        <div className="grid-2" style={{ marginBottom: 14 }}>
          {campo("Declaración del Hallazgo", "declaracion_hallazgo", { textarea: true, rows: 5, full: true })}
          {campo("N° de AC (Código)", "numero_ac_original")}
          {campo("Sede", "sede")}
          {campo("Fuente / Origen", "fuente_identificacion")}
          {campo("Proceso(s)", "procesos")}
          {campo("Área Responsable", "area_responsable")}
          <div>
            <label className="field-label">Estado</label>
            <select className="text-input" value={form.estado} onChange={set("estado")}>
              {ESTADOS_EDICION.map((e) => <option key={e} value={e}>{nombreEstado(e)}</option>)}
            </select>
          </div>
          {campo("¿Requiere cambio SGC?", "requiere_cambio_sgc")}
        </div>

        <p className="stage-title" style={{ fontSize: 12 }}>Plan de Acción</p>
        <div className="grid-2" style={{ marginBottom: 14 }}>
          {campo("Plan de Acción", "plan_accion", { textarea: true, rows: 4, full: true })}
          {campo("Fecha límite del formulario", "plazo_entrega_plan", { type: "date" })}
          {campo("Plazo de ejecución", "plazo_ejecucion", { type: "date" })}
          {campo("Fecha de Cierre", "fecha_cierre_plan")}
        </div>

        <p className="stage-title" style={{ fontSize: 12 }}>Observación / Verificación</p>
        {campo("Observación / Conclusión", "observacion", { textarea: true, rows: 3 })}

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
          {error && <span style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

function DetalleAccion({ id, rol, onBack }) {
  const [accion, setAccion] = useState(null);
  const [errorHistorico, setErrorHistorico] = useState("");
  const [cambiandoHistorico, setCambiandoHistorico] = useState(false);

  const cargar = () => {
    fetchAcciones().then((lista) => {
      const encontrada = lista.find((a) => a.id === id);
      setAccion(encontrada || null);
    });
  };

  useEffect(() => {
    cargar();
  }, [id]);

  if (!accion) return <p className="empty-note">Cargando...</p>;

  const codigoOficial = accion.numero_ac_original || accion.numero_accion || accion.numero || `AM BS-EA-${String(accion.id).padStart(2, "0")}-26`;
  const hallazgoTexto = accion.declaracion_hallazgo || accion.hallazgo_asunto || accion.hallazgo || "Sin descripción registrada.";

  const puedeCompletarPlan = rol === "Área Responsable" && ["Pendiente Plan de Acción", "Observada"].includes(accion.estado);
  const puedeVerificar = rol === "Sistemas de Gestión (calidad)" && accion.estado === "Pendiente Verificación";

  return (
    <div>
      <button className="back-link" onClick={onBack} style={{ marginBottom: 16 }}>
        <ChevronLeft size={14} style={{ verticalAlign: -2 }} /> Volver a la lista
      </button>

      {/* Tarjeta Encabezado */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="mono" style={{ margin: 0, color: "var(--accent)", fontSize: 20 }}>
            {codigoOficial}
          </h2>
          <span className={`pill ${estadoPill[accion.estado] || "pill-plan"} ${claseBadge(accion.estado)}`}>
            <IndicadorEstado estado={accion.estado} />{nombreEstado(accion.estado || "Pendiente Plan de Acción")}
          </span>
        </div>

        <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>
          <strong>Declaración del Hallazgo:</strong>
          <p style={{ margin: "4px 0 0", color: "var(--text-primary)" }}>{hallazgoTexto}</p>
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-soft)", fontSize: 13, color: "var(--text-secondary)" }}>
          <div><b>Sede:</b> {accion.sede || "El Alto"}</div>
          <div><b>Fuente/Origen:</b> {accion.fuente_identificacion || accion.origen || "BS"}</div>
          <div><b>Área Responsable:</b> {accion.area_responsable || accion.procesos || "BYF"}</div>
          <div><b>Categoría:</b> {accion.categoria || "—"}</div>
          <div><b>Subcategoría:</b> {accion.subcategoria || "—"}</div>
          <div><b>Cambio en SGC:</b> {accion.requiere_cambio_sgc || accion.cambio_sgc || "No"}</div>
        </div>
      </div>

      {accion.estado === "Observada" && accion.ultima_observacion && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--danger-text)" }}>
          <p className="stage-title" style={{ marginTop: 0, color: "var(--danger-text)" }}>
            Observación de Sistemas de Gestión
          </p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{accion.ultima_observacion}</p>
          {rol === "Área Responsable" && (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
              Corrige lo indicado en el formulario de abajo y vuelve a enviarlo.
            </p>
          )}
        </div>
      )}

      {accion.formulario_historico && <div className="card" style={{ marginBottom: 16 }}>
        <p className="stage-title" style={{ marginTop: 0 }}>Formulario histórico original</p>
        <p style={{ fontSize: 13 }}>Importado el {accion.formulario_historico.fecha_importacion} por {accion.formulario_historico.importado_por}.
          {accion.formulario_historico.seguimiento_activo ? " Seguimiento activo." : " Sin recordatorios automáticos."}</p>
        <a className="back-link" href={urlFormularioHistorico(accion.formulario_historico.id)} target="_blank" rel="noreferrer">
          Descargar Word original: {accion.formulario_historico.nombre_original}
        </a>
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Conserva las imágenes, firmas y sellos del documento importado. No cuenta como evidencia del plan.</p>
        {rol === "Sistemas de Gestión (calidad)" && accion.estado !== "Cerrada" && <button className="btn-primary" disabled={cambiandoHistorico}
          onClick={async () => {
            const activo = !accion.formulario_historico.seguimiento_activo;
            if (activo && !window.confirm("¿Activar el seguimiento? Si hay plazos vencidos, el sistema podrá enviar recordatorios al área.")) return;
            setCambiandoHistorico(true); setErrorHistorico("");
            try { await cambiarSeguimientoHistorico(accion.formulario_historico.id, activo); cargar(); }
            catch (err) { setErrorHistorico(err.message); }
            finally { setCambiandoHistorico(false); }
          }}>{cambiandoHistorico ? "Guardando..." : accion.formulario_historico.seguimiento_activo ? "Desactivar seguimiento" : "Activar seguimiento de este caso"}</button>}
        {errorHistorico && <p role="alert" style={{ color: "var(--danger-text)" }}>{errorHistorico}</p>}
      </div>}
      <AlertaPlazo alerta={accion.alerta_plazo} />
      <FormularioImpresion accion={accion} rol={rol} />

      {/* Plan de Acción — formulario si es tu turno de llenarlo, si no, solo lectura */}
      {puedeCompletarPlan ? (
        <PlanAccionForm accion={accion} onCompletado={onBack} />
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="stage-title" style={{ marginTop: 0 }}>Plan de Acción — Área Responsable</p>
          <div className="readonly-field" style={{ fontSize: 14, lineHeight: 1.6 }}>
            {accion.plan_accion || accion.correccion_inmediata || "No se ha registrado un plan de acción formal aún."}
          </div>

          {[
            ["Informe de investigación", accion.informe_investigacion],
            ["Análisis de causa raíz", accion.analisis_causa_raiz],
            ["Corrección inmediata", accion.correccion_inmediata],
            ["Evidencia que presentará", accion.evidencia_parte1],
            ["Responsable(s)", accion.responsables],
          ].map(([titulo, valor]) =>
            valor ? (
              <div key={titulo} style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
                <b>{titulo}:</b> {valor}
              </div>
            ) : null
          )}

          <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
            <div><b>Plazo de Ejecución:</b> {accion.plazo_ejecucion || accion.plazo_entrega_plan || accion.plazo_plan || "—"}</div>
            <div><b>Fecha de Cierre:</b> {accion.fecha_cierre_plan || accion.fecha_cierre || "—"}</div>
          </div>
        </div>
      )}

      {(accion.estado !== "Pendiente Plan de Acción" || (accion.evidencias || []).length > 0) && (
        <EvidenciasCard accion={accion} rol={rol} onCambio={cargar} />
      )}

      {rol === "Sistemas de Gestión (calidad)" && accion.estado !== "Cerrada" && (
        <ObservacionCard accion={accion} onEnviada={cargar} />
      )}

            {/* Verificación — formulario si es tu turno de cerrarla, si no, solo lectura */}
      {puedeVerificar ? (
        <VerificacionForm accion={accion} onCompletado={onBack} />
      ) : (
        <div className="card">
          <p className="stage-title" style={{ marginTop: 0 }}>Verificación — Sistemas de Gestión (Calidad)</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
            {accion.observacion || accion.descripcion_verificacion || accion.conclusion || "El formulario cuenta con informe de investigación y plan de acción redactado, pero la sección de verificación por parte de Sistemas de Gestión aún no ha sido completada."}
          </p>
          {accion.numero_accion_derivada && (
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--danger-text)" }}>
              Marcada como ineficaz — se abrió el caso <span className="mono">{accion.numero_accion_derivada}</span> como reincidencia.
            </p>
          )}
        </div>
      )}

      {/* Bitácora */}
      <div className="card" style={{ marginTop: 16 }}>
        <p className="stage-title" style={{ marginBottom: 8 }}>Bitácora</p>
        {(accion.historial || []).length === 0 ? (
          <p className="empty-note">Todavía no hay eventos registrados.</p>
        ) : (
          (accion.historial || []).map((h, i) => (
            <div className="timeline-item" key={i}>
              <span>{h.fecha}</span><span>—</span><span>{h.evento}</span>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

function ObservacionCard({ accion, onEnviada }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!texto.trim()) {
      setError("Escribe el comentario para el área");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await enviarObservacion(accion.id, texto.trim());
      setTexto("");
      onEnviada();
    } catch (e) {
      setError(e.message || "No se pudo enviar la observación");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p className="stage-title" style={{ marginTop: 0 }}>Observaciones para el área</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0 }}>
        Si el formulario tiene errores, escribe qué debe corregir. La acción pasa a “Observada” y al área le llega un correo con tu comentario.
      </p>
      <textarea className="text-input" rows={3} style={{ marginBottom: 12 }} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn-primary" onClick={enviar} disabled={enviando}>
          {enviando ? "Enviando..." : "Enviar observación al área"}
        </button>
        {error && <span style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</span>}
      </div>
    </div>
  );
}

function VerificacionForm({ accion, onCompletado }) {
  const [form, setForm] = useState({
    fecha_verificacion: "",
    coordinador_sistemas_gestion: "",
    evidencia_parte2: "",
    descripcion_verificacion: "",
    conclusion: "",
    es_ineficaz: false,
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const enviar = async () => {
    if (!form.descripcion_verificacion.trim()) {
      setError("Describe la verificación antes de cerrar el caso");
      return;
    }
    if (!form.conclusion.trim()) {
      setError("Escribe la conclusión de la revisión antes de cerrar el caso");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await completarVerificacion(accion.id, form);
      onCompletado();
    } catch (e) {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card">
      <p className="stage-title" style={{ marginTop: 0 }}>Verificación — Sistemas de Gestión (Calidad)</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 16 }}>
        Revisa si el plan de acción resolvió el problema y cierra el caso.
      </p>

      <label className="field-label">Descripción de la verificación</label>
      <textarea className="text-input" rows={3} style={{ marginBottom: 12 }} value={form.descripcion_verificacion} onChange={set("descripcion_verificacion")} />

      <label className="field-label">Evidencia del plan de acción revisada</label>
      <textarea className="text-input" rows={3} style={{ marginBottom: 12 }} value={form.evidencia_parte2} onChange={set("evidencia_parte2")}
        placeholder="Describe lo comprobado en los archivos. Sus nombres también aparecerán en el Word." />
      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div><label className="field-label">Fecha de verificación (hoy si se deja vacía)</label>
          <input className="text-input" type="date" value={form.fecha_verificacion} onChange={set("fecha_verificacion")} /></div>
        <div><label className="field-label">Coordinador de Sistemas de Gestión</label>
          <input className="text-input" value={form.coordinador_sistemas_gestion} onChange={set("coordinador_sistemas_gestion")}
            placeholder="Tu nombre de sesión si se deja vacío" /></div>
      </div>

      <label className="field-label">Conclusión</label>
      <textarea className="text-input" rows={3} style={{ marginBottom: 12 }} value={form.conclusion} onChange={set("conclusion")} />

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={form.es_ineficaz}
          onChange={(e) => setForm({ ...form, es_ineficaz: e.target.checked })}
        />
        El plan de acción resultó ineficaz (abrir una nueva Acción de Mejora vinculada)
      </label>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn-primary" onClick={enviar} disabled={enviando}>
          {enviando ? "Guardando..." : form.es_ineficaz ? "Cerrar y abrir reincidencia" : "Verificar y cerrar"}
        </button>
        {error && <span style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</span>}
      </div>
    </div>
  );
}

const OPCIONES_EXPORTAR = [
  { value: "todos", label: "Todos los registros" },
  { value: "pendientes_entrega", label: "Pendientes de entrega del plan" },
  { value: "cerrados", label: "Cerrados" },
];

const COLUMNAS_EXPORTAR = [
  { key: "numero", label: "Número" },
  { key: "numero_ac_original", label: "N° AC Original" },
  { key: "sede", label: "Sede" },
  { key: "estado", label: "Estado" },
  { key: "area_responsable", label: "Área Responsable" },
  { key: "declaracion_hallazgo", label: "Hallazgo" },
  { key: "plan_accion", label: "Plan de Acción" },
  { key: "observacion", label: "Observación" },
];

function ExportarPanel({ seleccionadas }) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [columnas, setColumnas] = useState(new Set(["numero", "estado", "declaracion_hallazgo", "area_responsable"]));

  const toggleColumna = (key) => {
    setColumnas((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const descargar = () => {
    const ids = seleccionadas && seleccionadas.size > 0 ? Array.from(seleccionadas) : undefined;
    const url = urlExportarAcciones(filtro, undefined, Array.from(columnas), ids);
    window.open(url, "_blank");
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button className="back-link" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setAbierto(!abierto)}>
        <Download size={14} /> Exportar a Excel
      </button>

      {abierto && (
        <div style={{ marginTop: 12 }}>
          <select className="text-input" style={{ maxWidth: 320, marginBottom: 10 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            {OPCIONES_EXPORTAR.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginBottom: 10 }}>
            {COLUMNAS_EXPORTAR.map((c) => (
              <label key={c.key} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={columnas.has(c.key)} onChange={() => toggleColumna(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={descargar}>Descargar .xlsx</button>
        </div>
      )}
    </div>
  );
}

function ImportarPanel({ onImportado }) {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  const ejecutarImportacion = async () => {
    if (!archivo) {
      setError("Por favor selecciona un archivo Excel (.xlsx o .xls)");
      return;
    }
    setCargando(true);
    setError("");
    setResultado(null);
    try {
      const res = await importarExcelAcciones(archivo);
      setResultado(res);
      if (onImportado) onImportado();
    } catch (e) {
      setError("Error al importar el archivo. Revisa el formato e intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <button className="back-link" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setAbierto(!abierto)}>
        <Upload size={14} /> Cargar / Importar Excel
      </button>

      {abierto && (
        <div style={{ marginTop: 12 }}>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => setArchivo(e.target.files[0] || null)}
            style={{ marginBottom: 10, display: "block" }}
          />
          <button className="btn-primary" onClick={ejecutarImportacion} disabled={cargando}>
            {cargando ? "Importando..." : "Subir archivo"}
          </button>
          {error && <p style={{ color: "var(--danger-text)", fontSize: 13, marginTop: 8 }}>{error}</p>}
          {resultado && <p style={{ color: "var(--success-text)", fontSize: 13, marginTop: 8 }}>¡Datos importados con éxito!</p>}
        </div>
      )}
    </div>
  );
}
