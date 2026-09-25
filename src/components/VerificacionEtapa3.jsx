import React, { useState } from 'react';

export default function VerificacionEtapa3({ accionId, onFinished }) {
  const [verificacion, setVerificacion] = useState({
    fecha_verificacion: new Date().toISOString().split('T')[0],
    descripcion_verificacion: '',
    evidencia_parte2: '',
    conclusion: '',
    coordinador_sistemas_gestion: 'Coordinación de Sistemas de Gestión',
    es_ineficaz: false,
    numero_accion_derivada: ''
  });

  const handleCerrar = async (e) => {
    e.preventDefault();
    await fetch(`/api/acciones/${accionId}/verificacion`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verificacion)
    });
    onFinished();
  };

  return (
    <form onSubmit={handleCerrar} className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
      <h3 className="text-xl font-bold text-white border-b border-slate-800 pb-2">
        Segunda Parte - Verificación (Sistemas de Gestión)
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300">Fecha de Verificación</label>
          <input
            type="date"
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
            value={verificacion.fecha_verificacion}
            onChange={(e) => setVerificacion({ ...verificacion, fecha_verificacion: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300">Coordinador de Sistemas de Gestión</label>
          <input
            type="text"
            readOnly
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-400 cursor-not-allowed"
            value={verificacion.coordinador_sistemas_gestion}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300">Descripción de la Verificación</label>
        <textarea
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
          value={verificacion.descripcion_verificacion}
          onChange={(e) => setVerificacion({ ...verificacion, descripcion_verificacion: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300">Conclusión del Plan</label>
        <textarea
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
          value={verificacion.conclusion}
          onChange={(e) => setVerificacion({ ...verificacion, conclusion: e.target.value })}
        />
      </div>

      {/* Manejo Condicional de Ineficacia */}
      <div className="flex items-center gap-3 p-3 bg-slate-800 rounded">
        <input
          type="checkbox"
          id="ineficaz"
          checked={verificacion.es_ineficaz}
          onChange={(e) => setVerificacion({ ...verificacion, es_ineficaz: e.target.checked })}
        />
        <label htmlFor="ineficaz" className="text-sm font-medium text-amber-400">
          ¿El plan fue ineficaz y requiere abrir una nueva Acción de Mejora?
        </label>
      </div>

      {verificacion.es_ineficaz && (
        <div>
          <label className="block text-sm font-medium text-amber-300">N° Nueva Acción de Mejora</label>
          <input
            type="text"
            placeholder="ej. AM BS-EA-11-26"
            className="w-full bg-slate-800 border border-amber-600 rounded p-2 text-white"
            value={verificacion.numero_accion_derivada}
            onChange={(e) => setVerificacion({ ...verificacion, numero_accion_derivada: e.target.value })}
          />
        </div>
      )}

      <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-bold text-white">
        Completar Verificación y Cerrar Caso
      </button>
    </form>
  );
}   