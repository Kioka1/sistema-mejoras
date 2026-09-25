import { useEffect, useState } from "react";
import { ChevronLeft, Send, Eye, Pencil } from "lucide-react";
import { fetchSolicitudes, crearSolicitud, responderSolicitud, editarSolicitud } from "../api.js";

const estadoPill = {
  Pendiente: "pill-plan",
  Respondida: "pill-cerrada",
};

// Simulación de "quién está usando el sistema" mientras no exista login real.
const ROLES = ["Sistemas de Gestión (calidad)", "Persona que responde"];

export default function SolicitudesView({ usuario }) {
  const rol = usuario.rol === "admin" ? "Sistemas de Gestión (calidad)" : "Persona que responde";
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccionada, setSeleccionada] = useState(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);

  const cargar = () => {
    setLoading(true);
    fetchSolicitudes().then(setSolicitudes).finally(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
  }, []);

  const volver = () => {
    setSeleccionada(null);
    setMostrarNueva(false);
    cargar();
  };

  if (mostrarNueva) {
    return <NuevaSolicitudForm onCancel={volver} onCreated={volver} />;
  }

  if (seleccionada) {
    return <DetalleSolicitud id={seleccionada.id} rol={rol} onBack={volver} />;
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 0, marginBottom: 16, maxWidth: 640 }}>
        Módulo aparte de Acciones de Mejora: úsalo cuando necesites que otra persona te llene
        un documento y quieras saber si ya respondió o no, en vez de mandarlo por correo a ciegas.
      </p>

            <div className="role-switch">
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Estás viendo como:</span>
        <span className="pill pill-verif">{rol}</span>
      </div>

      {rol === "Sistemas de Gestión (calidad)" && (
        <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => setMostrarNueva(true)}>
          <Send size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> Nueva Solicitud
        </button>
      )}

      {loading && <p className="empty-note">Cargando...</p>}
      {!loading && solicitudes.length === 0 && (
        <p className="empty-note">Todavía no hay solicitudes enviadas.</p>
      )}

      {!loading && solicitudes.length > 0 && (
        <div className="ticket-table-wrap">
          <table className="ticket-table">
            <colgroup>
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 70 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Estado</th>
                <th>N°</th>
                <th>Asunto</th>
                <th>Destinatario</th>
                <th>Enviada</th>
                <th>Plazo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => {
                const vencida = s.estado === "Pendiente" && s.plazo_respuesta && new Date(s.plazo_respuesta) < new Date();
                return (
                  <tr key={s.id} className={vencida ? "row-overdue" : ""}>
                    <td onClick={() => setSeleccionada(s)} style={{ cursor: "pointer" }}>
                      <span className={`pill ${estadoPill[s.estado] || "pill-nuevo"}`}>{s.estado}</span>
                    </td>
                    <td className="mono" onClick={() => setSeleccionada(s)} style={{ cursor: "pointer" }}>{s.numero}</td>
                    <td className="asunto-cell" onClick={() => setSeleccionada(s)} style={{ cursor: "pointer" }}>
                      <span className="asunto-text" title={s.asunto}>{s.asunto}</span>
                    </td>
                    <td onClick={() => setSeleccionada(s)} style={{ cursor: "pointer" }}>{s.destinatario_nombre || "—"}</td>
                    <td onClick={() => setSeleccionada(s)} style={{ cursor: "pointer" }}>{s.fecha_envio}</td>
                    <td onClick={() => setSeleccionada(s)} style={{ cursor: "pointer" }}>{s.plazo_respuesta || "—"}</td>
                    <td className="col-actions">
                      <button className="icon-btn" title="Ver / responder" onClick={() => setSeleccionada(s)}>
                        <Eye size={15} />
                      </button>
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

function NuevaSolicitudForm({ onCancel, onCreated }) {
  const [form, setForm] = useState({
    asunto: "",
    instrucciones: "",
    destinatario_nombre: "",
    destinatario_correo: "",
    plazo_respuesta: "",
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const enviar = async () => {
    if (!form.asunto.trim()) {
      setError("Escribe el asunto de la solicitud");
      return;
    }
    setEnviando(true);
    try {
      await crearSolicitud(form);
      onCreated();
    } catch (e) {
      setError("No se pudo crear la solicitud");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <button className="back-link" onClick={onCancel}>
        <ChevronLeft size={14} style={{ verticalAlign: -2 }} /> Cancelar
      </button>
      <div className="stage-section active-stage">
        <p className="stage-title">Nueva Solicitud</p>

        <label className="field-label">Asunto</label>
        <input className="text-input" style={{ marginBottom: 12 }} value={form.asunto} onChange={set("asunto")} />

        <label className="field-label">Instrucciones (qué necesitas que llene)</label>
        <textarea className="text-input" rows={3} style={{ marginBottom: 12 }} value={form.instrucciones} onChange={set("instrucciones")} />

        <div className="grid-2">
          <div>
            <label className="field-label">Nombre del destinatario</label>
            <input className="text-input" value={form.destinatario_nombre} onChange={set("destinatario_nombre")} />
          </div>
          <div>
            <label className="field-label">Correo del destinatario</label>
            <input className="text-input" type="email" placeholder="eate.xxxxxxxx@unifranz.edu.bo"
              value={form.destinatario_correo} onChange={set("destinatario_correo")} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="field-label">Plazo para responder</label>
          <input className="text-input" type="date" style={{ maxWidth: 220 }} value={form.plazo_respuesta} onChange={set("plazo_respuesta")} />
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn-primary" onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar solicitud"}
          </button>
          {error && <span style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

function DetalleSolicitud({ id, rol, onBack }) {
  const [solicitud, setSolicitud] = useState(null);
  const [respuesta, setRespuesta] = useState({
    informe_investigacion: "",
    analisis_causa_raiz: "",
    correccion_inmediata: "",
    plan_accion: "",
    evidencia: "",
    responsables: "",
    plazo_ejecucion: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState(false);

  const cargar = () => {
    fetchSolicitudes().then((lista) => setSolicitud(lista.find((s) => s.id === id) || null));
  };

  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (solicitud) {
      setRespuesta({
        informe_investigacion: solicitud.informe_investigacion || "",
        analisis_causa_raiz: solicitud.analisis_causa_raiz || "",
        correccion_inmediata: solicitud.correccion_inmediata || "",
        plan_accion: solicitud.plan_accion || "",
        evidencia: solicitud.evidencia || "",
        responsables: solicitud.responsables || "",
        plazo_ejecucion: solicitud.plazo_ejecucion || "",
      });
    }
  }, [solicitud]);

  if (!solicitud) return <p className="empty-note">Cargando...</p>;

  // El destinatario puede responder la primera vez y también editar su
  // respuesta después, por si Sistemas de Gestión le pide cambios.
  const puedeResponder = rol === "Persona que responde";
  const yaRespondio = solicitud.estado === "Respondida";

  const enviarRespuesta = async () => {
    setEnviando(true);
    try {
      const actualizada = await responderSolicitud(solicitud.id, respuesta);
      setSolicitud(actualizada);
    } finally {
      setEnviando(false);
    }
  };

  if (editando) {
    return (
      <EditarSolicitudForm
        solicitud={solicitud}
        onCancel={() => setEditando(false)}
        onSaved={() => { setEditando(false); cargar(); }}
      />
    );
  }

  return (
    <div>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} style={{ verticalAlign: -2 }} /> Volver a la lista
      </button>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <p className="mono" style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "var(--accent)" }}>{solicitud.numero}</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className={`pill ${estadoPill[solicitud.estado]}`}>{solicitud.estado}</span>
            {rol === "Sistemas de Gestión (calidad)" && (
              <button className="icon-btn" title="Editar" onClick={() => setEditando(true)}>
                <Pencil size={15} />
              </button>
            )}
          </div>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 14 }}>{solicitud.asunto}</p>
        {solicitud.instrucciones && (
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>{solicitud.instrucciones}</p>
        )}
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
          Para: {solicitud.destinatario_nombre || "—"} ({solicitud.destinatario_correo || "sin correo"}) · Plazo: {solicitud.plazo_respuesta || "—"}
        </p>
      </div>

      <div className={`stage-section ${puedeResponder ? "active-stage" : ""}`}>
        <p className="stage-title">Respuesta</p>

        {yaRespondio && !puedeResponder ? (
          <>
            <div className="readonly-field"><b>Investigación:</b> {solicitud.informe_investigacion || "—"}</div>
            <div className="readonly-field"><b>Causa raíz:</b> {solicitud.analisis_causa_raiz || "—"}</div>
            <div className="readonly-field"><b>Corrección inmediata:</b> {solicitud.correccion_inmediata || "—"}</div>
            <div className="readonly-field"><b>Plan de acción:</b> {solicitud.plan_accion || "—"}</div>
            <div className="readonly-field"><b>Evidencia:</b> {solicitud.evidencia || "—"}</div>
            <div className="readonly-field"><b>Responsable(s):</b> {solicitud.responsables || "—"} · <b>Plazo de ejecución:</b> {solicitud.plazo_ejecucion || "—"}</div>
          </>
        ) : puedeResponder ? (
          <>
            {yaRespondio && (
              <p className="empty-note" style={{ marginTop: 0 }}>
                Ya respondiste esta solicitud. Puedes editar los campos si Sistemas de Gestión te pidió cambios.
              </p>
            )}
            <label className="field-label">Informe de investigación</label>
            <textarea className="text-input" rows={2} style={{ marginBottom: 10 }}
              value={respuesta.informe_investigacion}
              onChange={(e) => setRespuesta({ ...respuesta, informe_investigacion: e.target.value })} />

            <label className="field-label">Análisis de causa raíz</label>
            <textarea className="text-input" rows={2} style={{ marginBottom: 10 }}
              value={respuesta.analisis_causa_raiz}
              onChange={(e) => setRespuesta({ ...respuesta, analisis_causa_raiz: e.target.value })} />

            <label className="field-label">Corrección inmediata</label>
            <textarea className="text-input" rows={2} style={{ marginBottom: 10 }}
              value={respuesta.correccion_inmediata}
              onChange={(e) => setRespuesta({ ...respuesta, correccion_inmediata: e.target.value })} />

            <label className="field-label">Plan de acción</label>
            <textarea className="text-input" rows={2} style={{ marginBottom: 10 }}
              value={respuesta.plan_accion}
              onChange={(e) => setRespuesta({ ...respuesta, plan_accion: e.target.value })} />

            <label className="field-label">Evidencia</label>
            <textarea className="text-input" rows={2} style={{ marginBottom: 10 }}
              value={respuesta.evidencia}
              onChange={(e) => setRespuesta({ ...respuesta, evidencia: e.target.value })} />

            <div className="grid-2">
              <div>
                <label className="field-label">Responsable(s)</label>
                <input className="text-input" value={respuesta.responsables}
                  onChange={(e) => setRespuesta({ ...respuesta, responsables: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Plazo de ejecución</label>
                <input className="text-input" type="date" value={respuesta.plazo_ejecucion}
                  onChange={(e) => setRespuesta({ ...respuesta, plazo_ejecucion: e.target.value })} />
              </div>
            </div>

            <button className="btn-primary" style={{ marginTop: 14 }} onClick={enviarRespuesta} disabled={enviando}>
              {enviando ? "Guardando..." : yaRespondio ? "Guardar cambios" : "Enviar respuesta"}
            </button>
          </>
        ) : (
          <p className="empty-note">Todavía no responde el destinatario.</p>
        )}
      </div>

      <div className="card">
        <p className="stage-title" style={{ marginBottom: 8 }}>Bitácora</p>
        {(solicitud.historial || []).map((h, i) => (
          <div className="timeline-item" key={i}>
            <span>{h.fecha}</span><span>—</span><span>{h.evento}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditarSolicitudForm({ solicitud, onCancel, onSaved }) {
  const [form, setForm] = useState({
    asunto: solicitud.asunto || "",
    instrucciones: solicitud.instrucciones || "",
    destinatario_nombre: solicitud.destinatario_nombre || "",
    destinatario_correo: solicitud.destinatario_correo || "",
    plazo_respuesta: solicitud.plazo_respuesta || "",
    estado: solicitud.estado || "Pendiente",
    informe_investigacion: solicitud.informe_investigacion || "",
    analisis_causa_raiz: solicitud.analisis_causa_raiz || "",
    correccion_inmediata: solicitud.correccion_inmediata || "",
    plan_accion: solicitud.plan_accion || "",
    evidencia: solicitud.evidencia || "",
    responsables: solicitud.responsables || "",
    plazo_ejecucion: solicitud.plazo_ejecucion || "",
  });
  const [guardando, setGuardando] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const guardar = async () => {
    setGuardando(true);
    try {
      await editarSolicitud(solicitud.id, form);
      onSaved();
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
        <p className="stage-title">Editar {solicitud.numero} — todos los campos</p>

        <label className="field-label">Asunto</label>
        <input className="text-input" style={{ marginBottom: 10 }} value={form.asunto} onChange={set("asunto")} />

        <label className="field-label">Instrucciones</label>
        <textarea className="text-input" rows={2} style={{ marginBottom: 10 }} value={form.instrucciones} onChange={set("instrucciones")} />

        <div className="grid-2" style={{ marginBottom: 10 }}>
          <div>
            <label className="field-label">Destinatario</label>
            <input className="text-input" value={form.destinatario_nombre} onChange={set("destinatario_nombre")} />
          </div>
          <div>
            <label className="field-label">Correo</label>
            <input className="text-input" value={form.destinatario_correo} onChange={set("destinatario_correo")} />
          </div>
          <div>
            <label className="field-label">Plazo de respuesta</label>
            <input className="text-input" type="date" value={form.plazo_respuesta} onChange={set("plazo_respuesta")} />
          </div>
          <div>
            <label className="field-label">Estado</label>
            <select className="text-input" value={form.estado} onChange={set("estado")}>
              <option>Pendiente</option>
              <option>Respondida</option>
            </select>
          </div>
        </div>

        {["informe_investigacion", "analisis_causa_raiz", "correccion_inmediata", "plan_accion", "evidencia"].map((campo) => (
          <div key={campo} style={{ marginBottom: 10 }}>
            <label className="field-label">{campo.replaceAll("_", " ")}</label>
            <textarea className="text-input" rows={2} value={form[campo]} onChange={set(campo)} />
          </div>
        ))}

        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}