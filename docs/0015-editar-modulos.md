# 0015 · Editar estados y comentarios desde los módulos

Plan aprobado por Felipe el 2026-11-23. Primera parte: estados y comentarios. Crear gastos de caja menor va en otro PR.

## Reglas

- Solo edita quien tiene el módulo en "editar". La revisión se hace en el servidor, al abrir y al guardar.
- Cada módulo declara sus campos editables (`editar` en `DefTabla`). Los IDs salen del mapeo generado (`TABLAS` o `ESCRITURA`) y las opciones de los selects, del esquema vivo de Airtable, con 10 minutos de memoria.
- Solo se ofrecen campos de tipo select, texto o casilla. Fórmulas, enlaces y montos nunca se editan aquí.
- Todo pasa por la cola con el valor que la persona vio al abrir. Si Airtable cambió entre tanto, gana Airtable y la persona lo ve. La cola deja la escritura en AUDITORIA con el antes y el después.
- Nada se borra. Una opción que no existe en Airtable no pasa.

## Qué se edita

| Módulo | Campos |
|---|---|
| Operación (RESERVAS) | Novedades, Comentario, Requiere limpieza |
| Limpiezas | Estado, Comentario |
| Unidades Host, Unidades Living | Estado |
| Liquidaciones (F_CORTAS) | Estado, Comentario |
| Alistamiento (PROY_AMOB) | Estado del pedido |
| Comercial Host (LEADS) | Estado |
| Contratos, Cobros | Estado |
| Actas, Pagos de obra | Estado |
| Finanzas · Movimientos | Estado, Categoría, Comentario |

Comercial Living (WEB LEADS) no tiene Estado y queda de solo lectura. La fecha y la funcionaria de una limpieza se siguen cambiando en Airtable: mover una limpieza toca la programación de `vh-programacion-limpiezas`.
