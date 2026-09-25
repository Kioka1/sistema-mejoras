// Datos de ejemplo para probar el prototipo mientras se define
// de dónde y cómo va a llegar la información real (Excel/PDF que
// proporcione la ingeniera de Sistemas de Gestión).
//
// Cuando exista un backend real, este archivo se reemplaza por
// llamadas a la API (fetch/axios) que traigan los registros desde
// la base de datos.

export const initialData = [
  {
    id: 1,
    tipo: "Incidencia",
    titulo: "Caída del sistema de matrículas",
    sistema: "Matrículas",
    categoria: "Disponibilidad",
    prioridad: "Alta",
    estado: "Resuelto",
    fecha: "2026-08-10",
  },
  {
    id: 2,
    tipo: "Oportunidad de mejora",
    titulo: "Automatizar generación de kardex",
    sistema: "Kardex",
    categoria: "Eficiencia",
    prioridad: "Media",
    estado: "En revisión",
    fecha: "2026-08-12",
  },
  {
    id: 3,
    tipo: "Incidencia",
    titulo: "Error en cálculo de pagos duplicados",
    sistema: "Pagos",
    categoria: "Datos",
    prioridad: "Alta",
    estado: "Nuevo",
    fecha: "2026-08-15",
  },
  {
    id: 4,
    tipo: "Incidencia",
    titulo: "Lentitud al consultar matrícula",
    sistema: "Matrículas",
    categoria: "Rendimiento",
    prioridad: "Media",
    estado: "En revisión",
    fecha: "2026-08-18",
  },
  {
    id: 5,
    tipo: "Oportunidad de mejora",
    titulo: "Notificar por correo cambios en kardex",
    sistema: "Kardex",
    categoria: "Comunicación",
    prioridad: "Baja",
    estado: "Nuevo",
    fecha: "2026-08-19",
  },
  {
    id: 6,
    tipo: "Incidencia",
    titulo: "Correos institucionales rebotando",
    sistema: "Correo institucional",
    categoria: "Disponibilidad",
    prioridad: "Alta",
    estado: "Nuevo",
    fecha: "2026-08-20",
  },
];
