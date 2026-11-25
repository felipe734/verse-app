# 0025 · Leads de Living

Fase 2.1. Comercial Living deja de ser una lista de solo lectura: cada lead de la web tiene estado, responsable y seguimiento.

## Airtable (con OK de Felipe, 2026-11-24)

En 7. LIVING › LEADS (en el catálogo, WEB LEADS):

| Campo | Tipo | Uso |
|---|---|---|
| Estado | opción | Nuevo, Contactado, Visita, Datos pedidos, Contrato, Ganado, Perdido |
| Responsable | texto | Quien atiende el lead |
| Contactado el | fecha y hora | Sello del primer contacto |
| Notas | texto largo | Seguimiento y motivo si se pierde |

Los 15 leads de los últimos 30 días quedaron en Nuevo. Los más viejos quedan vacíos.

## En la app

- Abre en tablero por Estado, con Mío / Todo sobre Responsable.
- El detalle trae el WhatsApp como enlace (wa.me, agrega 57 a celulares de 10 dígitos), el mensaje de la web y las notas.
- "Contactado" es acción de un toque. Al pasar a Contactado, por la acción o desde la edición, se sella Contactado el.
- Alerta roja `leads-living-sin-contacto`: lead en Nuevo o sin estado más de 48 h después de llegar, últimos 30 días.

Quien tiene `living-comercial` en editar (plantilla Comercial) mueve los leads.
