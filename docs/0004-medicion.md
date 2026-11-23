# 0004 · Medición de llamadas a Airtable y costo de Neon

Fecha: 2026-11-22

Llamadas: el cliente de Airtable avisa cada llamada HTTP; un contador por petición las agrupa por base y las suma al final en `llamadas_airtable` (día de Bogotá, workspace, base). El workspace sale del CATÁLOGO. Sirve para cuidar el plan gratis del workspace C&C.

Neon: el cron nocturno lee el proyecto en la API de Neon (`compute_time_seconds`, `synthetic_storage_size`) y guarda en `costos_neon` el costo estimado del período a la fecha con los precios del plan Launch: US$0,106 por hora de cómputo y US$0,35 por GB-mes. Necesita `NEON_API_KEY` y `NEON_PROJECT_ID` en Vercel; sin ellas no se mide y no falla.

La pantalla Sistema (entrega 3) mostrará las dos tablas.
