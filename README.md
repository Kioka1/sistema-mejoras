# Sistema de Registro y Seguimiento de Mejoras e Incidencias

Prototipo — Práctica Profesional, Sistemas de Gestión, Sede El Alto.

## Arquitectura

Este proyecto ahora está dividido en dos partes independientes, como corresponde a una arquitectura **Cliente-Servidor**:

```
┌─────────────────────┐        peticiones HTTP        ┌──────────────────────┐
│   FRONTEND (cliente) │  ────────────────────────────>│  BACKEND (servidor)  │
│   React + Vite       │  <────────────────────────────│  FastAPI + SQLite    │
│   corre en :5173     │        respuestas JSON         │  corre en :8000       │
└─────────────────────┘                                └──────────────────────┘
```

- **Frontend (`/src`)**: solo se encarga de mostrar la información y capturar
  lo que el usuario escribe. No guarda datos por su cuenta — todo lo pide o
  envía al backend.
- **Backend (`/backend`)**: recibe esas peticiones, las valida, las guarda en
  la base de datos y responde con la información en formato JSON. Es el único
  que toca la base de datos.

Esta separación es importante porque permite, más adelante, que varias
personas usen el sistema al mismo tiempo desde distintas computadoras, todas
hablando con el mismo servidor central — y es la base para que el sistema
pueda escalar a otras sedes en el futuro.

## Cómo correrlo (hay que levantar las dos partes)

### 1. Backend (servidor)

```bash
cd backend
python3 -m venv venv          # solo la primera vez
./venv/bin/pip install fastapi "uvicorn[standard]" sqlalchemy pydantic
./venv/bin/uvicorn main:app --reload
```

Queda corriendo en `http://localhost:8000`. Puedes ver y probar todos los
endpoints en `http://localhost:8000/docs` (documentación automática de FastAPI).

En Windows, activa el entorno virtual con `venv\Scripts\activate` antes del
`pip install`, o usa `venv\Scripts\python -m pip install ...`.

### 2. Frontend (cliente)

En otra terminal, sin cerrar la del backend:

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

**Importante:** el frontend necesita que el backend esté corriendo para
mostrar datos. Si ves un mensaje de error de conexión, revisa que el
backend siga activo en el puerto 8000.

## Estructura del proyecto

```
backend/
  main.py                  -> servidor FastAPI, define todos los endpoints
  database.py               -> conexión a la base de datos y modelo de la tabla Registro
  schemas.py                 -> validación de los datos que entran/salen de la API

src/
  api.js                    -> funciones que llaman al backend (fetch)
  App.jsx                   -> pantalla principal, navegación por barra lateral
  index.css                  -> tema visual (oscuro, inspirado en el portal estudiantil)
  components/
    BuscarView.jsx            -> búsqueda con resultados relacionados
    RegistrarView.jsx         -> formulario para registrar una incidencia/mejora
    CargarView.jsx            -> simulación de carga de datos (Excel/PDF)
    PanelView.jsx              -> panel de indicadores y gráficos
```

## Qué es real y qué es simulado

- **Buscar, Registrar, Acciones de Mejora y Panel**: funcionan de verdad — los
  datos van y vienen del backend, y quedan guardados en la base de datos
  (`sistema_mejoras.db`, un archivo SQLite que se crea solo la primera vez
  que corres el backend).
- **Cargar datos**: todavía solo simula la importación (agrega un registro de
  ejemplo al hacer clic). Falta definir con el área el mecanismo real de
  carga de archivos.
- **Las notificaciones de Acciones de Mejora** (avisar a la otra persona
  cuando le toca completar su parte) por ahora solo quedan registradas en
  la consola del backend (`[NOTIFICACIÓN SIMULADA]`). Falta confirmar qué
  correo institucional usa la universidad para conectar el envío real.
- **Los roles** ("Sistemas de Gestión (calidad)" / "Área Responsable") se
  simulan con un selector arriba de la pantalla, porque todavía no hay un
  sistema de usuarios/login. Cuando se defina el acceso, este selector se
  reemplaza por el usuario real que inició sesión.

## Módulo de Acciones de Mejora

Implementa el flujo de 3 etapas del formulario que compartió el área de
calidad (`Formulario_de_Acción_de_Mejora.docx`):

1. **Creación** (Sistemas de Gestión / calidad): registra el hallazgo y
   asigna un Área Responsable. Genera un número correlativo (AM-0001, AM-0002...).
2. **Plan de Acción** (Área Responsable): investiga, define la causa raíz
   y el plan. Al enviarlo, el caso pasa a "Pendiente Verificación".
3. **Verificación** (Sistemas de Gestión / calidad): confirma que el plan
   se cumplió y cierra el caso.

Cada acción guarda una **bitácora** con fecha y evento de cada cambio de
etapa, visible en el detalle de cada caso.

## Diseño visual

La paleta de colores y la barra lateral con íconos están inspiradas en el
portal estudiantil de la universidad, para que el sistema se sienta parte
de la misma familia de herramientas institucionales.

## Próximos pasos sugeridos

1. Validar estas pantallas con el área y anotar qué cambiarían.
2. Cuando el proyecto avance a una etapa de producción, cambiar la base de
   datos de SQLite a PostgreSQL — en `backend/database.py` solo hay que
   cambiar la variable `DATABASE_URL`, el resto del código no cambia.
3. Definir el mecanismo real de carga de datos en `CargarView.jsx` y en un
   nuevo endpoint del backend (Excel/PDF, y si corresponde, OCR para fotos).
4. Agregar autenticación de usuarios cuando el área lo requiera.

Este proyecto es una base de trabajo, no una versión final — está pensado
para irse ajustando junto con el área a medida que se confirmen los
requerimientos.
