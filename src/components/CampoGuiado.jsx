import { cloneElement, useId } from "react";

export function GuiaRoles() {
  return <div className="guia-roles">
    <span className="guia-marca guia-gestion">X Completa Sistemas de Gestión · Administrador</span>
    <span className="guia-marca guia-area">X Completar este campo · Usuario / Área Responsable</span>
    <p>Las indicaciones dentro de los campos desaparecen al escribir y vuelven si borras el contenido. Son una guía y no se guardan como datos.</p>
  </div>;
}

export function SeccionGuiada({ rol = "gestion", children }) {
  return <p className={`guia-seccion guia-${rol}`}>{children}</p>;
}

// La guía se superpone al control vacío sin bloquear clics ni formar parte del valor.
export default function CampoGuiado({ children, rol = "gestion", guia, etiqueta }) {
  const id = useId();
  const texto = guia || (rol === "area" ? "X Completar este campo" : "X Completa Sistemas de Gestión");
  const vacio = !String(children.props.value ?? "").trim();
  const fecha = children.props.type === "date";
  const selector = children.type === "select";
  const control = cloneElement(children, {
      "aria-label": etiqueta || children.props["aria-label"],
      "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" "),
      // Se conserva la ayuda original en la descripción accesible.
      placeholder: undefined,
    });
  const indicacion = (vacio || selector) && <span aria-hidden="true" className="campo-guia"><span>{texto}</span></span>;
  return <div className={`campo-guiado guia-${rol}${fecha || selector ? " campo-guiado-en-linea" : ""}${selector ? " campo-guiado-selector" : ""}`}>
    {fecha || selector ? <div className="campo-guiado-control">{control}{indicacion}</div> : <>{control}{indicacion}</>}
    <span id={id} className="sr-only">{rol === "area" ? "Completa el usuario del Área Responsable." : "Completa el administrador de Sistemas de Gestión."} {texto} {children.props.placeholder}</span>
  </div>;
}
