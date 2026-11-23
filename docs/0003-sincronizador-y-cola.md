# 0003 · Sincronizador, cola de escrituras y auditoría

Fecha: 2026-11-22

Alcance de la entrega 0: TRAZABILIDAD VERSE, TRAZABILIDAD C&C (las dos en 9. VERSE OS), UNIDADES de 5. INVENTARIO y UNIDADES de 7. LIVING. Las cuatro están en el workspace Verse.

Copia: `registros` guarda cada fila por ID de campo con una huella. `tareas` y `unidades` son proyecciones para las pantallas.

Carga y reconciliación: `reconciliar` trae la tabla completa, compara fila por fila por huella, corrige faltantes, sobrantes y distintas, y deja una fila en `reconciliaciones`. Con la copia vacía es la carga completa. Corre cada noche a las 2:00 (Bogotá) con Vercel Cron en `/api/cron/noche`. La entrega 0 queda lista cuando `cuadra` es verdadero tres noches seguidas.

Webhooks: uno por tabla (Airtable permite un alcance de tabla por webhook). El aviso llega firmado con HMAC a `/api/airtable/webhook`; se leen los cambios desde el cursor, se vuelven a traer las filas tocadas y se borran las destruidas. Airtable vence los webhooks a los 7 días; el cron los renueva. Crear un webhook es una escritura en Airtable, así que solo se crean con `WEBHOOKS_ACTIVOS=1` en Vercel, tras el OK de Felipe.

Workspace C&C: sus tablas se leerán al abrir el módulo y cada noche, sin webhook. En la entrega 0 no hay tablas de ese workspace.

Escrituras: nada va directo a Airtable. `encolar` deja la escritura con autor y el valor que el usuario vio. `procesarCola` toma pendientes con `FOR UPDATE SKIP LOCKED`, espera 220 ms entre llamadas a una misma base (menos de 5 por segundo), compara con Airtable y, si la fila cambió, no escribe: gana Airtable. Reintenta 429 y 5xx hasta 5 veces con espera creciente. Cada resultado queda en `auditoria` con antes y después.

Migraciones: `pnpm db:migrar` corre en el build de Vercel. Hoy la vista previa y producción usan la misma base de Neon.
