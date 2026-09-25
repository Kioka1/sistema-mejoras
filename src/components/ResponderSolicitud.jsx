import React, { useState } from 'react';

export default function ResponderSolicitud({ solicitudId, token }) {
  const [form, setForm] = useState({
    informe_investigacion: '',
    analisis_causa_raiz: '',
    correccion_inmediata: '',
    plan_accion: '',
    evidencia: '',
    responsables: '',
    plazo_ejecucion: ''
  });

  const handleSave = async (e) => {
    e.preventDefault();
    await fetch(`/api/solicitudes/${solicitudId}/responder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    alert('Plan de acción registrado con éxito.');
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-3xl mx-auto p-6 bg-slate-900 rounded-xl">
      <h2 className="text-2xl font-bold text-white mb-2">Primera Parte: Área Responsable</h2>
      
      <div>
        <label className="block text-sm font-medium text-slate-300">
          Análisis de Causa – Raíz (Puedes usar 5 Porqués, Diagrama de Pescado o 5W+2H)
        </label>
        <textarea
          rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
          value={form.analisis_causa_raiz}
          onChange={(e) => setForm({ ...form, analisis_causa_raiz: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300">
          Corrección Inmediata (¿Cómo solucionamos el problema de forma inmediata?)
        </label>
        <textarea
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
          value={form.correccion_inmediata}
          onChange={(e) => setForm({ ...form, correccion_inmediata: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300">
          Plan de Acción (¿Cómo eliminamos la causa raíz?)
        </label>
        <textarea
          rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
          value={form.plan_accion}
          onChange={(e) => setForm({ ...form, plan_accion: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300">Responsable(s)</label>
          <input
            type="text"
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
            value={form.responsables}
            onChange={(e) => setForm({ ...form, responsables: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Enlace o RUTA de Evidencia</label>
          <input
            type="text"
            placeholder="URL del archivo o DRIVE"
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
            value={form.evidencia}
            onChange={(e) => setForm({ ...form, evidencia: e.target.value })}
          />
        </div>
      </div>

      <button type="submit" className="w-full py-3 bg-orange-600 hover:bg-orange-500 rounded font-bold text-white">
        Guardar Respuesta
      </button>
    </form>
  );
}