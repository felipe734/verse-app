# 0021 · Programación de aseos (fase 1.2)

Fecha: 2026-11-24. Plan aprobado por Felipe el mismo día: llenar Total y Estado Pago al crear.

Botón **Programación** en Limpiezas de Verse, para quien tiene el módulo en editar (Maestro, administración y coordinación de aseo; las aseadoras no). La alerta "salidas sin limpieza" abre directo ahí (`?programar=1`).

## Qué muestra (próximos 7 días)

- **Salidas sin aseo**: salidas de RESERVAS sin una limpieza de esa unidad ese día. Botón Programar con la unidad y la fecha ya puestas.
- **Aseos de la semana**, por día y hora, con la aseadora. Sin aseadora sale en rojo. Tocar uno abre el cambio de aseadora, fecha u hora. Los terminados no se tocan.
- **Nuevo aseo**: cualquier unidad en estado Actual.

## Qué escribe en 6. OPERACION 360 · LIMPIEZA

Solo campos que ya existen. No crea tablas ni campos.

| Acción | Campos |
|---|---|
| Programar | Unidad, Fecha (día y hora de Bogotá, guardada en UTC), Estado = Programado, Funcionaria enlace y Funcionario (la opción de "Nombre en LIMPIEZA" de FUNCIONARIAS), Total = Valor Limpieza de la unidad, Estado Pago = Pendiente, Comentario |
| Cambiar | Funcionaria enlace y Funcionario, y Fecha |

- Antes de crear revisa que la unidad no tenga otro aseo ese día, para no duplicar lo de vh-programacion-limpiezas.
- Si la unidad no tiene Valor Limpieza, Total y Estado Pago quedan vacíos.
- Cambiar va con el valor que se veía: si Airtable cambió entre tanto, gana Airtable.
- Solo aseadoras activas en FUNCIONARIAS.
- Todo pasa por la cola y queda en AUDITORIA (`aseos.programado`, `aseos.cambiado`). Nada se borra.

Código: `lib/aseos/programacion.ts`, `app/modulos/aseos.ts`, `components/modulos/aseos/programacion.tsx`. Campos nuevos en el mapeo: LIMPIEZA Total y Estado Pago; UNIDADES UND, Estado, Producto y Valor Limpieza.
