
# Sistema de Mejoras

Frontend en React/Vite y backend en FastAPI con SQLAlchemy.

## Seguridad y despliegue

El backend requiere `JWT_SECRET_KEY`, una clave privada aleatoria de al menos
32 caracteres. Conserva ese nombre por compatibilidad con la configuración anterior.
Ahora protege los identificadores de sesión almacenados en la base de datos.
Las variables del entorno tienen prioridad sobre `backend/.env`.

Para una instalación nueva, copia `backend/.env.example` a `backend/.env` y
completa `JWT_SECRET_KEY`. Puedes generar su valor desde la carpeta `backend`:

```powershell
.\venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

El cambio de versión invalida los JWT anteriores y exige volver a iniciar sesión.
Al arrancar, el backend crea las tablas `sesiones_usuarios`, `identidades_google`
y `desafios_google`. La sesión usa una cookie de navegador `HttpOnly` y
`SameSite=Strict`, con `Secure` habilitado por defecto. Caduca a los 30 minutos
de inactividad o a las 8 horas desde el ingreso. Las consultas automáticas
no renuevan la sesión. El servidor revoca la sesión al salir y todas las
sesiones del usuario al cambiar su contraseña o su estado activo.

Los administradores ingresan con la contraseña del sistema. Google requiere
una identidad verificada de Google Workspace de `unifranz.edu.bo`.
Un usuario existente confirma su contraseña del sistema al vincular Google por
primera vez. Si antes usaba únicamente Google, un administrador le asigna una
nueva contraseña desde Usuarios para completar la vinculación. Un administrador
debe dar de alta a los usuarios nuevos antes de que puedan ingresar con Google.

### Entorno local y publicación

Vite 7 requiere Node.js 20.19+, 22.12+ o una versión posterior compatible.
Si cambias el cliente OAuth, configura el mismo ID en `GOOGLE_CLIENT_ID` del
backend y `VITE_GOOGLE_CLIENT_ID` del frontend, y registra el origen en Google.

- Desarrollo local. Ejecuta `npm run dev` y abre `http://localhost:5173`.
  Vite reenvía `/api` a `127.0.0.1:8000`. Ejecuta Uvicorn desde `backend` con
  `.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips 127.0.0.1 --no-access-log`.
  Si el navegador rechaza cookies `Secure` en HTTP local, usa
  `SESSION_COOKIE_SECURE=false` solo en ese entorno.
- Producción. Ejecuta `npm run build` y publica exclusivamente el contenido de
  `dist` en la raíz del sitio HTTPS. Reenvía `/api/` a Uvicorn mediante el proxy
  del mismo origen. Configura `CORS_ORIGINS` con el origen HTTPS exacto,
  por ejemplo `https://mejoras.example.org`, y conserva `SESSION_COOKIE_SECURE=true`.
  Las escrituras también validan `Origin`. Un cliente HTTP debe enviarlo
  junto con la cookie de sesión. El proxy debe reemplazar las cabeceras de IP
  y protocolo reenviados y Uvicorn debe confiar únicamente en ese proxy.
  Configura redirección a HTTPS, HSTS y un límite de cuerpo de 16 MiB en el proxy.
- En XAMPP, la regla `.htaccess` de la raíz restringe el acceso directo al
  repositorio. Para producción, configura el `DocumentRoot` del sitio en
  `dist`, guarda los datos fuera de la raíz pública y evita publicar Vite o el puerto de Uvicorn.
- Los límites se calculan por proceso. Ejecuta un solo worker de Uvicorn para
  aplicar el cupo de usuario a toda esta instancia. Si instalas varios workers
  o réplicas, comparte los contadores y aplica un límite adicional en el proxy.
  Se permiten 600 solicitudes por IP, 180 por usuario, 30 de autenticación por IP
  y 40 multipart por IP, por minuto. El ingreso permite 10 intentos por cuenta en
  15 minutos. Las respuestas `429` incluyen `Retry-After`.

### Acceso a la API

Las rutas públicas son `POST /api/auth/login`, `POST /api/auth/google` y
`POST /api/auth/google/desafio`. Tienen validación de origen y límites de tráfico.
El desafío de Google se consume una sola vez y vence a los 10 minutos.
Las demás rutas de negocio requieren sesión. Las consultas y escrituras de
usuarios, catálogos de áreas, registros generales, panel general, importaciones
y exportaciones son administrativas. Las acciones y evidencias verifican el
área, las solicitudes verifican al destinatario y las notificaciones verifican
al titular. Swagger, ReDoc y OpenAPI están deshabilitados.

Las respuestas de error de validación omiten valores de entrada. Los errores
internos y de correo se registran por tipo, sin volcar contraseñas, tokens,
parámetros SQL ni el cuerpo de las notificaciones. Los adjuntos se comprueban
por tamaño y tipo, y se sirven como descargas privadas. La comprobación de
formato no sustituye el análisis antimalware de los archivos.

## Correos institucionales

Los avisos se envían a cada usuario activo que pertenezca a alguna de las áreas
asignadas, sin duplicar destinatarios por pertenecer a varias áreas. La firma de
Abigail E. Arancibia Vásquez se conserva en `backend/templates/firma_correo.html`;
su imagen se incorpora al mensaje desde `firma_unifranz.png`, sin descargarla al
abrir el correo. Cada aviso incluye una versión HTML y otra de texto plano.

Configura `SMTP_USER` y `SMTP_PASSWORD` de una cuenta institucional autorizada en
el entorno privado del servidor. La implementación actual utiliza SMTP con SSL
en el puerto 465 y autenticación; para Gmail se necesita una contraseña de
aplicación permitida por la administración de Google Workspace. La contraseña
habitual de la cuenta no sirve para este mecanismo. Si TI exige OAuth o un relay
institucional con otro mecanismo, se deberá adaptar el transporte antes de activar
los envíos. No copies credenciales al código ni al control de versiones.

`SMTP_FROM_NAME` controla el nombre visible; la dirección remitente real es
`SMTP_USER`. Para enviar desde `abigail.arancibia@unifranz.edu.bo`, esa debe ser
la cuenta de envío autorizada. `SMTP_REPLY_TO` dirige las respuestas a Abigail.
`SISTEMA_URL` agrega el enlace de acceso: debe ser una dirección accesible para
los destinatarios. Conservar vacío mientras no se haya definido la publicación.

Los correos de vencimiento empiezan un día hábil antes de la entrega del
formulario o de las evidencias, y continúan el día límite y mientras esté
vencido, como máximo una vez por día y etapa. Las alertas visuales siguen
anticipándose dos días hábiles. El servidor debe estar encendido; revisa los
plazos cada hora. Tras configurar el entorno o actualizar el código, reinicia
el backend. Sin credenciales SMTP se conservan únicamente los avisos internos.

Las pruebas simulan SMTP; no demuestran recepción real. Antes de ponerlo en uso,
verifica con la cuenta autorizada y un destinatario de prueba tanto recepción
como formato en Gmail. La apariencia puede variar entre clientes de correo.

## Comprobaciones

Desde la raíz del proyecto:

```powershell
npm run build
node --test src/*.test.js
.\backend\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

Las pruebas usan una base SQLite en memoria, simulan el correo y no escriben
archivos de evidencia. Verifican sesiones, configuración JWT y el flujo de
corrección, reasignación y reenvío de evidencias.

## Evidencias y formulario para impresión

El responsable puede registrar varias acciones del plan. En cada una escribe
los nombres de los archivos esperados, uno por línea. La pantalla y la API
exigen coincidencia completa, ignorando mayúsculas, acentos, extensiones
permitidas, espacios y guiones bajos. No se aceptan coincidencias parciales,
nombres repetidos dentro de una acción, ni más de un archivo para el mismo
casillero. Los planes antiguos con descripciones generales de evidencia deben
corregirse para indicar nombres concretos antes de recibir sus archivos.

La sección «Formulario cerrado para impresión» aparece en el detalle de una
acción cerrada. Descarga un Word completado desde la plantilla institucional
`backend/templates/accion_mejora.docx`; conserva su encabezado, logotipo, tablas
y estilos. Incluye investigación, plan, nombres de archivos, fechas y cierre.
Los casos abiertos no permiten esta descarga, tampoco mediante la API.

Sistemas de Gestión puede adjuntar una imagen PNG/JPG de firma y sello, de hasta
3 MB, solo para esa descarga. La imagen no se conserva ni es obligatoria. La
descarga no sustituye la revisión del contenido de los archivos por el equipo.
Las evidencias de una acción cerrada no pueden subirse, reasignarse ni borrarse.

Las pruebas comprueban la estructura del Word, el llenado, las imágenes y la
conservación de las partes de la plantilla. La revisión visual de paginación
e impresión está pendiente: el renderizador no dispone de LibreOffice en este
entorno. Textos extensos pueden aumentar la cantidad de páginas del formulario.

## Limpieza de acciones de prueba

Desde la raíz, `backend/venv/Scripts/python.exe backend/limpiar_acciones.py`
muestra las cantidades sin modificar datos. Agregar `--aplicar` respalda y
elimina todas las acciones y sus planes, historiales, asignaciones, registros
de evidencia y notificaciones vinculadas. Usar solo cuando se haya decidido
vaciar las acciones; también eliminaría acciones reales si las hubiera.

Antes de borrar se crea y verifica un ZIP en `backend/uploads/respaldos`,
con las filas originales y los archivos de evidencia disponibles. El borrado
se realiza en una transacción. Conserva usuarios, áreas, solicitudes,
recomendaciones, archivos originales y secuencias de IDs internos. El directorio
de respaldos está excluido de Git por la regla `uploads/`.

El modo `--solo-catalogos` muestra también solicitudes, historiales de
solicitudes, recomendaciones y registros generales. Combinado con `--aplicar`
respalda y vacía todos esos datos operativos, conservando únicamente usuarios,
áreas y sus asignaciones (`usuario_areas`). Sin `--aplicar` solo consulta.

## Importación de formularios Word anteriores

En «Cargar datos», la opción «Importar formulario Word antiguo» admite un `.docx`
ya llenado por vez, con el formato institucional, de hasta 15 MB. «Leer y revisar
formulario» extrae los campos sin crear todavía una acción. El administrador
revisa el texto, confirma el estado real, la sede y las áreas; recién al confirmar
se guarda el caso. No admite `.doc`, PDF ni extracción de texto dentro de fotos.
Los campos no reconocidos pueden corregirse antes de importar.

Se conservan el código original y las fechas disponibles. La fecha de registro
original se deja vacía si no se conoce: la fecha de importación se guarda aparte.
La sugerencia de estado no cierra el caso automáticamente. Para los formularios
ya terminados, seleccionar «Cerrada»; si faltan archivos, «Pendiente de evidencia».

El Word original se conserva sin cambios, incluyendo firmas, sellos e imágenes,
y se descarga desde el detalle del caso. No se convierte en evidencia de ejecución.
Los archivos originales y su metadato están separados de las evidencias del plan.
Se rechazan archivos ya importados y códigos duplicados.

Los casos históricos se importan sin avisos automáticos por defecto. En un caso
pendiente se puede activar el seguimiento al importar o desde su detalle. Al
activarlo, los plazos deben ser fechas ISO (`AAAA-MM-DD`); si ya vencieron, la
revisión periódica o la consulta de acciones puede enviar recordatorios.
Importar un caso no envía un correo de nueva asignación.

### Plazos hábiles y alertas de entrega

Las nuevas asignaciones de formularios tienen 10 días hábiles por defecto desde
el envío al área. Sistemas de Gestión puede indicar entre 1 y 365 días hábiles
o una fecha exacta. Se cuentan lunes a viernes, sin descontar feriados, usando
la fecha de Bolivia. Las fechas existentes se conservan.

Las evidencias vencen 2 días hábiles después del plazo de ejecución del plan.
La entrega sigue disponible desde el final de la ejecución; subir archivos no
sustituye el botón de envío a Sistemas de Gestión. El estado inicial se muestra
como «Pendiente de llenado de formulario», conservando su valor interno para
compatibilidad. Una franja izquierda y el indicador del estado pulsan en rojo
mientras falta el formulario, en naranja mientras faltan evidencias y en verde
mientras espera verificación. El fondo permanece estable; los bordes se iluminan
al pasar el mouse o enfocar los controles. La fecha y
el texto distinguen los vencimientos; los otros estados conservan las alertas
por plazo desde 2 días hábiles antes. El texto permanece visible y la preferencia
de movimiento reducido desactiva la animación. Leer avisos no elimina un pendiente.

La campanita incluye entregas pendientes independientes del historial de avisos,
filtradas por las áreas del usuario. Los administradores también ven las
verificaciones pendientes para revisar y cerrar. Los listados y la campanita se actualizan
cada minuto, al volver a la pestaña y después de guardar o enviar. Los avisos
de vencimiento se generan como máximo una vez al día por etapa; los históricos
con seguimiento desactivado no generan alertas. No se requiere migrar columnas.

El backend crea la tabla nueva `formularios_historicos` al iniciar, sin alterar
las columnas existentes. Reiniciar el backend para cargar las rutas nuevas si
no se usa recarga automática. La utilidad de limpieza incluye también el
metadato y el archivo original en sus respaldos.
