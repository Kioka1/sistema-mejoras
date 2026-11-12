import { useState } from "react";
import { descargarFormularioWord } from "../api.js";

export default function FormularioImpresion({ accion, rol }) {
  const [imagen, setImagen] = useState(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  if (accion.estado !== "Cerrada") return null;
  const descargar = async () => {
    setOcupado(true); setError("");
    try { await descargarFormularioWord(accion, imagen); }
    catch (err) { setError(err.message || "No se pudo descargar el formulario."); }
    finally { setOcupado(false); }
  };
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p className="stage-title" style={{ marginTop: 0 }}>Formulario cerrado para impresión</p>
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Descarga el formulario institucional con los datos del caso y las evidencias registradas para tu respaldo físico.
      </p>
      {rol === "Sistemas de Gestión (calidad)" && <div style={{ marginBottom: 12 }}>
        <label className="field-label">Firma y sello (imagen opcional PNG o JPG, máximo 3 MB)</label>
        <input type="file" accept="image/png,image/jpeg" disabled={ocupado} onChange={(e) => {
          setError("");
          const archivo = e.target.files?.[0] || null;
          if (archivo && archivo.size > 3 * 1024 * 1024) {
            setError("La imagen supera los 3 MB."); setImagen(null); e.target.value = "";
          } else { setImagen(archivo); }
        }} />
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Si adjuntas una imagen, se incorpora solo en esta descarga. No es obligatoria ni se guarda para otros casos.
        </p>
      </div>}
      <button type="button" className="btn-primary" disabled={ocupado} onClick={descargar}>
        {ocupado ? "Generando Word..." : "Descargar formulario Word"}
      </button>
      {error && <p role="alert" style={{ fontSize: 13, color: "var(--danger-text)" }}>{error}</p>}
    </div>
  );
}
