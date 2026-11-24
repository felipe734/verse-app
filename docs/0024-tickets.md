# 0024 · Tickets (fase 1.5)

Fecha: 2026-11-24. Plan aprobado por Felipe el mismo día.

## Airtable

Tabla nueva **TICKETS** en 6. OPERACION 360 (`tbln65eSWc0cDhvre`), con fila en el CATÁLOGO DE DATOS. Al enlazarla, Airtable agregó el campo inverso "TICKETS" en UNIDADES y en SERVICIOS.

| Campo | Tipo |
|---|---|
| Título | texto (principal) |
| Unidad | enlace a UNIDADES |
| Tipo | Daño, Faltante, Implementos, Mantenimiento, Huésped, Otro |
| Prioridad | Alta, Media, Baja |
| Estado | Abierto, En curso, Cerrado |
| Responsable | texto |
| Fecha límite | fecha |
| Origen | enlace a SERVICIOS (el reporte que lo abrió) |
| Evidencia | adjuntos |
| Comentario | texto largo |
| Cerrado el | fecha y hora |
| Creado por | texto (correo o "Ruta de aseo") |

## En la app

Módulo **Tickets** en Host (`/verse/host/tickets`), en tablero por Estado. Muestra los abiertos y los cerrados de los últimos 30 días. Lo tienen el Maestro, administración (editar) y coordinación de aseo (editar).

- **Nuevo ticket**: qué pasa, unidad, tipo, prioridad, responsable, límite y detalle. Sin límite, sale de la prioridad: Alta 1 día, Media 3, Baja 7.
- **Editar** estado, prioridad, responsable y comentario. **Cerrar** con un toque o moviendo la tarjeta a Cerrado. Al cerrar se sella **Cerrado el** con la hora.
- **Solos desde la Ruta de aseo**: un reporte con daños abre un ticket "Daños en …" (Alta); con implementos, "Implementos para …" (Media); con actividades pendientes, "Actividades pendientes en …" (Media). Van enlazados a la unidad y al reporte de SERVICIOS. Si abrir el ticket falla, el reporte se guarda igual.
- **Alerta en rojo**: tickets no cerrados con la fecha límite vencida.

Todo por la cola y en AUDITORIA (`tickets.abierto`). Evidencia por foto desde la app queda para después; hoy el video va en el reporte de SERVICIOS enlazado.

Código: `lib/tickets/tickets.ts`, `app/modulos/tickets.ts`, `components/modulos/tickets/nuevo-ticket.tsx`, la definición en `lib/modulos/tablas-equipo.ts` y el sello de fecha en `lib/modulos/editar.ts`.
