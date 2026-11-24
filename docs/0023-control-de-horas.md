# 0023 · Control de horas (fase 1.4)

Fecha: 2026-11-24. Plan aprobado por Felipe el mismo día.

En **Equipo** de Verse, encima de la tabla de turnos, una tarjeta por funcionaria para la semana que se está viendo:

- **Trabajadas, Meta y Diferencia** con las reglas de vh-control-horas: 7,5 h de lunes a viernes, 4,5 h el sábado, 0 el domingo y los festivos, y 1 h de almuerzo si el turno pasa de 5 h. Las horas se calculan con Ingreso y Salida.
- **Días** de la semana, con los días programados sin registro en rojo y los festivos en gris.
- **Turnos sin salida** de días ya pasados (olvidos de cierre). Quien tiene Equipo en editar los cierra con la hora real: escribe **Salida** (el mismo día del ingreso, máximo 14 h) y agrega una **Nota** "Salida corregida por … desde Verse App". Si Airtable cambió, gana Airtable.
- **Validar semana** marca **Validado** en todos los turnos de esa funcionaria en la semana. No deja validar con turnos sin salida.

No crea tablas ni campos. Todo por la cola y en AUDITORIA (`horas.salida_corregida`, `horas.semana_validada`). El correo del lunes a Diana lo sigue mandando vh-control-horas desde Claude.

Código: `lib/horas/semana.ts`, `lib/horas/festivos.ts`, `components/modulos/horas/`, `app/modulos/horas.ts`. Mapeo: CONTROL HORAS gana Validado.
