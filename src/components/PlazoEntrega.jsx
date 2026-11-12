export function fechaBolivia() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/La_Paz" }).format(new Date());
}

export function sumarHabiles(fecha, cantidad) {
  const dia = new Date(`${fecha}T12:00:00Z`);
  let faltan = Number(cantidad);
  while (faltan > 0) {
    dia.setUTCDate(dia.getUTCDate() + 1);
    if (dia.getUTCDay() !== 0 && dia.getUTCDay() !== 6) faltan--;
  }
  return dia.toISOString().slice(0, 10);
}

export default function PlazoEntrega({ value, onChange }) {
  const hoy = fechaBolivia();
  let dias = 0;
  if (value >= hoy) {
    const dia = new Date(`${hoy}T12:00:00Z`);
    while (dia.toISOString().slice(0, 10) < value) {
      dia.setUTCDate(dia.getUTCDate() + 1);
      if (dia.getUTCDay() !== 0 && dia.getUTCDay() !== 6) dias++;
    }
  }
  return <div className="plazo-entrega">
    <label className="field-label">Plazo para llenar y enviar el formulario</label>
    <div className="grid-2">
      <label className="field-label">Días hábiles desde el envío
        <input className="text-input" type="number" min="1" max="365" value={dias || ""}
          onChange={(e) => {
            const dias = Number(e.target.value);
            if (Number.isInteger(dias) && dias >= 1 && dias <= 365) onChange(sumarHabiles(fechaBolivia(), dias));
          }} />
      </label>
      <label className="field-label">Fecha límite
        <input className="text-input" type="date" min={fechaBolivia()} value={value}
          onChange={(e) => onChange(e.target.value)} required />
      </label>
    </div>
    <p className="empty-note">Por defecto: 10 días hábiles (2 semanas). Puedes cambiar los días o elegir una fecha. Se cuentan lunes a viernes.</p>
  </div>;
}
