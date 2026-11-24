# 0020 · Pulso de Host (fase 1.1)

Fecha: 2026-11-24

Franja en Inicio, antes del resumen y las alertas, para quien ve Operación de Verse. Responde en una mirada cómo está la operación hoy y mañana.

| Cifra | Cómo se cuenta |
|---|---|
| Ocupación hoy | Unidades con la noche de hoy dentro de una reserva (Ingreso ≤ hoy < Salida), sobre las unidades de 6. OPERACION 360 · UNIDADES con Estado Actual y Tipo Servicio Operación 360 o Digital. Si UNIDADES no se puede leer, se muestra solo el número de ocupadas. |
| Entradas hoy | Reservas con Ingreso hoy, con la Hora Ingreso si la tiene. Abajo, las de mañana. |
| Salidas hoy | Reservas con Salida hoy. Abajo, las de mañana. |
| Aseos hoy | Limpiezas de hoy terminadas sobre el total. En rojo si hoy o mañana hay alguna sin aseadora. Solo para quien ve Limpiezas. |

Debajo, una línea por día con las unidades que entran y salen.

- Solo lee: tres consultas a Airtable (RESERVAS, LIMPIEZA y UNIDADES) con la caché de 60 segundos. No escribe nada y no trae montos.
- Si falla, la franja no aparece y el resto de Inicio carga igual.
- Las fechas son el día de Bogotá.
- Código: `lib/pulso/host.ts` (cálculo puro `calcularPulso` y lectura `pulsoHost`), `components/inicio/pulso.tsx`.
