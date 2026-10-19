import { useEffect, useState } from "react";
import { fetchAreas, crearArea } from "../api.js";

/**
 * Selector de una o varias áreas/carreras.
 * - value: lista de nombres elegidos (["ODO", "DAF"])
 * - onChange: recibe la nueva lista
 * - Muestra las áreas del catálogo como casillas y permite agregar una nueva.
 */
export default function AreasSelector({ value = [], onChange, permitirCrear = true }) {
  const [catalogo, setCatalogo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAreas()
      .then(setCatalogo)
      .catch(() => setError("No se pudieron cargar las áreas"))
      .finally(() => setCargando(false));
  }, []);

  const norm = (t) => (t || "").trim().toLowerCase();
  const estaElegida = (nombre) => value.some((v) => norm(v) === norm(nombre));

  const alternar = (nombre) => {
    if (estaElegida(nombre)) onChange(value.filter((v) => norm(v) !== norm(nombre)));
    else onChange([...value, nombre]);
  };

  const agregar = async () => {
    const nombre = nueva.trim();
    if (!nombre) return;
    setError("");
    try {
      const lista = await crearArea(nombre);
      setCatalogo(lista);
      const oficial = lista.find((a) => norm(a) === norm(nombre)) || nombre;
      if (!estaElegida(oficial)) onChange([...value, oficial]);
      setNueva("");
    } catch (e) {
      setError(e.message || "No se pudo crear el área");
    }
  };

  // Áreas elegidas que ya no estén en el catálogo (por si acaso) también se muestran
  const todas = [...catalogo, ...value.filter((v) => !catalogo.some((c) => norm(c) === norm(v)))];

  return (
    <div>
      {cargando && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Cargando áreas...</span>}

      {!cargando && todas.length === 0 && (
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Todavía no hay áreas. Agrega la primera abajo.
        </span>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {todas.map((a) => {
          const activa = estaElegida(a);
          return (
            <label
              key={a}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 13,
                cursor: "pointer",
                border: `1px solid ${activa ? "var(--accent)" : "var(--border-soft)"}`,
                background: activa ? "rgba(249, 115, 22, 0.12)" : "transparent",
                color: activa ? "var(--accent)" : "var(--text-primary)",
              }}
            >
              <input type="checkbox" checked={activa} onChange={() => alternar(a)} style={{ accentColor: "var(--accent)" }} />
              {a}
            </label>
          );
        })}
      </div>

      {permitirCrear && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, maxWidth: 360 }}>
          <input
            className="text-input"
            placeholder="Nueva área o carrera (ej. ODO)"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
          />
          <button type="button" className="btn-secondary" onClick={agregar} style={{ whiteSpace: "nowrap" }}>
            + Agregar
          </button>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: "var(--danger-text)", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
