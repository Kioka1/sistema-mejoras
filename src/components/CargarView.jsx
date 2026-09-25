import { useState, useRef } from "react";
import { importarExcelAcciones } from "../api.js";

export default function CargarView() {
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError("Por favor, selecciona un archivo de Excel válido (.xlsx)");
      return;
    }

    setLoading(true);
    setError(null);
    setMensaje(null);

    try {
      const data = await importarExcelAcciones(file);
      setMensaje({ importados: data.importados, hojas: data.hojas_procesadas });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls"
        style={{ display: "none" }}
      />

      <div
        className="dropzone"
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: "2px dashed var(--border-soft)",
          padding: "24px",
          textAlign: "center",
          cursor: loading ? "wait" : "pointer",
          borderRadius: "8px",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <p style={{ margin: "0 0 4px", fontSize: 14, color: "var(--text-primary)" }}>
          {loading ? "Procesando archivo..." : "Haz clic o arrastra un archivo Excel (.xlsx) aquí"}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
          Soporta el libro de trabajo multi-sede del área de Sistemas de Gestión.
        </p>
      </div>

      {mensaje && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "rgba(74, 222, 154, 0.1)",
            border: "1px solid var(--success-text)",
            borderRadius: "8px",
            fontSize: 13,
            color: "var(--success-text)",
          }}
        >
          <strong>¡Importación exitosa!</strong>
          <p style={{ margin: "4px 0 0" }}>
            Se importaron <strong>{mensaje.importados}</strong> registros en total.
          </p>
          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
            {mensaje.hojas.map((hoja, idx) => (
              <li key={idx}>{hoja}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "rgba(239, 100, 100, 0.1)",
            border: "1px solid var(--danger-text)",
            borderRadius: "8px",
            fontSize: 13,
            color: "var(--danger-text)",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}