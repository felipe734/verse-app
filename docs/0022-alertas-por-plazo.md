# 0022 · Alertas en rojo por plazo (fase 1.6)

Fecha: 2026-11-24. Plazos del plan nuevo aprobado por Felipe.

| Alerta | Rojo (alta) | Aviso (media) | Abre |
|---|---|---|---|
| Aseos sin aseadora | Hoy o mañana: menos de 24 h para conseguirla | El resto de la semana | Programación de aseos |
| Leads de Host sin contactar | Estado "Lead" (o vacío) más de 48 h después de llegar, en los últimos 30 días | — | Comercial Host, lista filtrada en Lead |
| Arriendos vencidos | POR PAGAR con más de 5 días de atraso | Vencidos hace 5 días o menos | Cobros por pagar |
| Salidas sin limpieza | Como antes (próximos 3 días) | — | Programación de aseos |

- Las rojas van primero en Inicio, en la cabecera de cada módulo y en el resumen del día.
- Leads de Living (WEB LEADS) no tienen estado de contacto en Airtable. Su alerta de 48 h llega con la fase 2, que agrega ese estado (con plan y OK de Felipe).
- Solo leen; no escriben en Airtable.

Código: `lib/alertas/operacion.ts`. Pruebas en `tests/unit/alertas.test.ts`.
