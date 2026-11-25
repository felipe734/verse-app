# 0026 · Cobros de Living

Fase 2.4. Marcar un arriendo como pagado deja rastro y comprobante.

## Airtable (con OK de Felipe, 2026-11-24)

En 7. LIVING › INGRESOS: Fecha pago (fecha), Soporte (adjunto) y Marcado por (texto).

## En la app

- "Pagado" (acción de un toque, edición o arrastrar en el tablero) llena Fecha pago con el día de Bogotá y Marcado por con el nombre en Airtable de quien lo hizo (`sello` con `autor` en lib/modulos/editar.ts; un campo de solo fecha recibe el día, no la hora).
- En el detalle, "Subir soporte y marcar pagado": el comprobante (imagen o PDF, hasta 15 MB) sube a Vercel Blob (carpeta `cobros`) y llega a Airtable con URL firmada de 24 h. Se suma a los soportes que ya había. Si el cobro seguía POR PAGAR, queda PAGO en la misma escritura.
- Todo va por la cola con el Estado que se vio y queda en AUDITORIA (`cobros.soporte`).

Las filas del mes las sigue creando el cierre (vl-liquidacion). El recordatorio al arrendatario queda para después: hoy el Correo ya permite redactarlo a mano.
