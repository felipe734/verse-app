# 0029 · Renovaciones de Living

Fase 2.5. La decisión de renovar se toma con tiempo y se ve en la app.

## Alertas

Regla `renovacionesSinDecidir` en lib/alertas/operacion.ts. Cuenta las unidades de 7. LIVING › UNIDADES en Estado Actual, con Renovación vacía o Pendiente y Fecha Salida en los próximos 90 días:

| Alerta | Plazo | Nivel |
|---|---|---|
| `renovaciones-60d` | 60 días o menos | Alta, en rojo. El preaviso de vivienda es de 90 días |
| `renovaciones-90d` | Entre 61 y 90 días | Media |

Ambas llevan a Unidades Living con el filtro Actual. La alerta de 30 días sobre CONTRATO (`contratos-por-terminar`) sigue igual.

## En Unidades Living

- Columna y filtro Renovación.
- Acciones de un toque: "Renueva" pone Renovado y "No renueva" pone Terminación.
- Renovación también se edita desde el detalle, igual que Estado.

No hay cambios en Airtable: Renovación ya existía (Terminación / Pendiente / Renovado). El otrosí o contrato nuevo de la renovación sigue con vl-renovaciones en Claude.
