# 0005 · Respaldo de Airtable a Drive

Fecha: 2026-11-22

Alcance: las tablas del CATÁLOGO dentro de la app. Decisión de Felipe (2026-11-22): FELIPE, 5. VENTAS 54-47 y 6. OTROS no entran, porque el token de Airtable no tiene acceso a esas bases. Las tablas Histórica solo el día 1.

Destino: la unidad compartida "Verse · Respaldos Airtable" (`RESPALDO_DRIVE_ID`), en `AAAA-MM-DD / base / tabla.json` y `tabla.csv`. El JSON guarda los campos por ID y el esquema, para poder restaurar. El CSV va por nombre de campo y con BOM para Excel. Las tablas propias de la app van en `AAAA-MM-DD / _app`, sin los secretos de los webhooks.

Acceso sin claves: la organización bloquea las claves de cuentas de servicio (`iam.disableServiceAccountKeyCreation`). Vercel entrega un token OIDC, Google lo intercambia en el pool `vercel` (proyecto verse-app, condición: solo producción de verse-app) y se actúa como `verse-respaldos`, que es Administrador de contenido de la unidad.

Ejecución: Vercel Cron a las 2:30 Bogotá en `/api/cron/respaldo`. Una tarea por tabla en `respaldo_tareas`; cada vuelta trabaja hasta 230 s y, si quedan pendientes, se llama a sí misma (máximo 40 vueltas). Una tabla que falla se reintenta hasta 3 veces.

Retención: se conservan las 30 carpetas de fecha más recientes y el día 1 de los 12 meses más recientes. Las demás van a la papelera de la unidad, que Google vacía a los 30 días. Carpetas que no son fechas no se tocan.

Adjuntos: cada adjunto de las tablas respaldadas se registra en `respaldo_adjuntos` por su ID y se guarda una sola vez en `Adjuntos / base / tabla / <id>-<nombre>`, fuera de las carpetas de fecha (la retención no lo toca). Se descarga de Airtable y se sube a Drive por flujo, sin cargarlo en memoria. Si el enlace guardado tiene más de una hora, se pide uno nuevo a Airtable; si el adjunto ya no existe, se olvida. Los videos de limpieza (tablas SERVICIOS y LIMPIEZA) no se respaldan: decisión de Felipe (2026-11-22), que cambia lo que pedía el doc (una vez por semana). Las fotos y archivos de esas tablas sí entran, y los videos de otras tablas también. El día no se cierra hasta guardar los adjuntos pendientes; la primera vez puede tomar varias vueltas.

Restauración: `POST /api/respaldo/restaurar` con la clave del cron y `{ fecha, base, tabla }`. Lee el JSON de esa fecha en Drive y crea en la misma base una tabla nueva `RESTAURADA AAAA-MM-DD · tabla`. Los tipos simples se conservan (texto, número, moneda, porcentaje, casilla, fecha, selección, correo, URL, teléfono); vínculos, fórmulas, lookups y adjuntos quedan como texto largo, con el enlace de Drive del adjunto si ya está guardado. Nunca escribe sobre la tabla original; la restaurada la borra Felipe a mano.

Corridas: al terminar el respaldo se deja una Corrida en TRAZABILIDAD VERSE (OK, Con pendientes o Falló) y, si no es OK, un Pendiente para Felipe enlazado a ella. El cron de las 2:00 deja la Corrida "App" con la sincronización y revisa que el respaldo de la noche anterior haya terminado. Todo va por la cola, con auditoría, y solo se escribe con `CORRIDAS_ACTIVAS=1`. El Proceso es "Respaldo" o "App" si esas opciones existen en el campo; si no, "Verse OS". La app no cambia el esquema de Airtable.
