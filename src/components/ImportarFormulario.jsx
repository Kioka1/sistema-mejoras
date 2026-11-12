import { nombreEstado } from "../estados.js";
import { useRef, useState } from "react";
import { revisarFormularioWord, importarFormularioWord } from "../api.js";
import AreasSelector from "./AreasSelector.jsx";

const ESTADOS = ["Pendiente Plan de Acción", "Observada", "En ejecución", "Pendiente de evidencia", "Pendiente Verificación", "Cerrada"];
const CAMPOS = [
  ["Número original de la acción *", "numero_ac_original"],
  ["Fuente de identificación", "fuente_identificacion"],
  ["Proceso(s)", "procesos"],
  ["Fecha de registro original (si se conoce)", "fecha_creacion"],
  ["Declaración del hallazgo *", "declaracion_hallazgo", true],
  ["Informe de investigación", "informe_investigacion", true],
  ["Análisis de causa raíz", "analisis_causa_raiz", true],
  ["Corrección inmediata", "correccion_inmediata", true],
  ["Plan de acción", "plan_accion", true],
  ["Evidencia indicada en el formulario", "evidencia_parte1", true],
  ["Responsable(s)", "responsables"],
  ["Fecha de llenado del formulario", "fecha_llenado_parte1"],
  ["Plazo de entrega del formulario (si corresponde)", "plazo_entrega_plan"],
  ["Plazo de ejecución del plan", "plazo_ejecucion"],
  ["Fecha de verificación", "fecha_verificacion"],
  ["Descripción de la verificación", "descripcion_verificacion", true],
  ["Evidencia revisada por Sistemas de Gestión", "evidencia_parte2", true],
  ["Conclusión", "conclusion", true],
  ["Coordinador de Sistemas de Gestión", "coordinador_sistemas_gestion"],
  ["Número de acción derivada (si corresponde)", "numero_accion_derivada"],
  ["Observación sobre el registro histórico", "observacion", true],
];

export default function ImportarFormulario({ onImported }) {
  const inputArchivo = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [lectura, setLectura] = useState(null);
  const [datos, setDatos] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));
  const leer = async () => {
    if (!archivo) { setError("Selecciona un formulario Word .docx ya llenado."); return; }
    if (archivo.size > 15 * 1024 * 1024) { setError("El formulario supera los 15 MB."); return; }
    setOcupado(true); setError(""); setExito(""); setLectura(null); setDatos(null);
    try {
      const resultado = await revisarFormularioWord(archivo);
      setLectura(resultado);
      setDatos({ ...resultado.datos, hash_archivo: resultado.hash_archivo,
        estado: "", areas: [], activar_seguimiento: false });
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  };
  const guardar = async (e) => {
    e.preventDefault();
    if (!datos.areas.length) { setError("Selecciona al menos un área responsable."); return; }
    setOcupado(true); setError("");
    try {
      const accion = await importarFormularioWord(archivo, datos);
      setExito(`${accion.numero_ac_original || accion.numero} importada como «${nombreEstado(accion.estado)}». Se conservó el Word original.`);
      setLectura(null); setDatos(null); setArchivo(null);
      if (inputArchivo.current) inputArchivo.current.value = "";
      if (onImported) onImported();
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  };
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <p className="stage-title" style={{ marginTop: 0 }}>Importar formulario Word antiguo</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Carga un formulario .docx ya llenado, revisa sus campos y confirma su estado real.
        Puedes registrar casos cerrados o pendientes de evidencia sin volver a escribir todo.
        El original se conserva con sus imágenes, firmas y sellos.
      </p>
      <input ref={inputArchivo} type="file" accept=".docx" disabled={ocupado}
        onChange={(e) => { setArchivo(e.target.files?.[0] || null); setLectura(null); setDatos(null); setError(""); setExito(""); }} />
      <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={leer} disabled={!archivo || ocupado}>
        {ocupado ? "Procesando..." : "Leer y revisar formulario"}
      </button>
      {exito && <p role="status" style={{ color: "var(--success-text)" }}>{exito}</p>}
      {lectura && datos && <form onSubmit={guardar} style={{ marginTop: 20 }}>
        <fieldset disabled={ocupado} style={{ border: 0, padding: 0, minWidth: 0 }}>
          <p><b>Revisa los datos antes de importar</b></p>
          <ul style={{ paddingLeft: 20, fontSize: 13, color: "var(--text-secondary)" }}>
            {lectura.advertencias.map((aviso, i) => <li key={i}>{aviso}</li>)}
          </ul>
          {lectura.duplicado && <p role="alert" style={{ color: "var(--danger-text)" }}>
            Se encontró un registro existente: {lectura.duplicado.numero}. El sistema impedirá importar el mismo archivo o código dos veces.
          </p>}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div><label className="field-label" htmlFor="historico-estado">Estado real del caso *</label>
              <select id="historico-estado" required className="text-input" value={datos.estado} onChange={(e) => {
                cambiar("estado", e.target.value);
                if (e.target.value === "Cerrada") cambiar("activar_seguimiento", false);
              }}>
                <option value="">— Confirma el estado —</option>
                {ESTADOS.map((estado) => <option key={estado} value={estado}>{nombreEstado(estado)}</option>)}
              </select>
              <p style={{ fontSize: 12 }}>Sugerencia según el texto: {nombreEstado(lectura.estado_sugerido)}. Confirma lo que ocurrió realmente.</p>
            </div>
            <div><label className="field-label" htmlFor="historico-sede">Sede *</label>
              <select id="historico-sede" required className="text-input" value={datos.sede || ""} onChange={(e) => cambiar("sede", e.target.value)}>
                <option value="">— Selecciona —</option>
                {["El Alto", "La Paz", "Cochabamba", "Santa Cruz", "Nacional"].map((sede) => <option key={sede}>{sede}</option>)}
              </select>
            </div>
          </div>
          <label className="field-label">Área(s) responsable(s) *</label>
          <AreasSelector value={datos.areas} onChange={(areas) => cambiar("areas", areas)} permitirCrear={false} />
          <div className="grid-2" style={{ marginTop: 16 }}>
            {CAMPOS.map(([label, campo, largo]) => <div key={campo} style={largo ? { gridColumn: "1 / -1" } : undefined}>
              <label className="field-label" htmlFor={`historico-${campo}`}>{label}</label>
              {largo ? <textarea id={`historico-${campo}`} className="text-input" rows={3} required={campo === "declaracion_hallazgo"}
                value={datos[campo] || ""} onChange={(e) => cambiar(campo, e.target.value)} />
                : <input id={`historico-${campo}`} className="text-input" required={campo === "numero_ac_original"}
                  value={datos[campo] || ""} onChange={(e) => cambiar(campo, e.target.value)}
                  placeholder={campo.includes("fecha") || campo.includes("plazo") ? "AAAA-MM-DD; conserva la fecha original" : ""} />}
            </div>)}
          </div>
          {datos.estado && datos.estado !== "Cerrada" && <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
            <input type="checkbox" checked={datos.activar_seguimiento} onChange={(e) => cambiar("activar_seguimiento", e.target.checked)} />
            Activar seguimiento y recordatorios de este caso pendiente
          </label>}
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Por defecto se guarda como archivo histórico sin avisos automáticos. Si activas el seguimiento y el plazo ya venció,
            el sistema podrá enviar recordatorios al consultar las acciones. La importación no envía un correo de nueva asignación.
            El Word original no cuenta como evidencia de ejecución.
          </p>
          <button className="btn-primary" style={{ marginTop: 12 }} disabled={ocupado}>
            {ocupado ? "Importando..." : "Confirmar e importar formulario"}
          </button>
        </fieldset>
      </form>}
      {error && <p role="alert" style={{ color: "var(--danger-text)", fontSize: 13 }}>{error}</p>}
    </div>
  );
}
