# 0019 · Copias en Postgres de RESERVAS, LIMPIEZA e INGRESOS

Fecha: 2026-11-23

## Qué se copia

El sincronizador de la entrega 0 (ver 0003) suma cuatro tablas, solo en `registros` (copia fiel por ID de campo, sin proyección):

| Clave | Base · tabla | Para qué | Webhook |
|---|---|---|---|
| `reservasHost` | 6. OPERACION 360 · RESERVAS | Salidas sin limpieza, búsqueda ⌘K | Sí |
| `limpiezasHost` | 6. OPERACION 360 · LIMPIEZA | Salidas sin limpieza, limpiezas sin funcionaria | Sí |
| `ingresosLivingCopia` | 7. LIVING · INGRESOS | Cobros vencidos | Sí |
| `unidadesOperacionCopia` | 6. OPERACION 360 · UNIDADES | Nombre de la unidad que enlazan RESERVAS y LIMPIEZA | No, solo de noche |

- La carga completa la hace la reconciliación de la noche (2:00). Desde ahí, los webhooks mantienen la copia al momento.
- Los tres webhooks nuevos se crean solos en esa corrida si `WEBHOOKS_ACTIVOS=1` (aprobado por Felipe el 2026-11-23). Airtable los vence a los 7 días y el cron los renueva.
- Se guardan todas las columnas de cada fila, como ya pasa con TRAZABILIDAD y UNIDADES. La copia vive en Neon, con el mismo acceso que el resto de la base.

## Qué se lee de la copia

- Tres alertas: salidas sin limpieza, limpiezas sin funcionaria y cobros vencidos. Llegan a Inicio, al resumen del día y a la cabecera de cada módulo.
- La búsqueda de reservas por unidad en ⌘K.
- Contratos por terminar y movimientos sin soporte siguen leyendo de Airtable, porque sus tablas no se copian.

Las fechas se comparan como el día de Bogotá. Una fecha sola ("2026-11-24") se toma tal cual. Una fecha con hora, que Airtable entrega en UTC, se pasa a Bogotá (`lib/copias/leer.ts`, `diaDe`).

## Cuándo se usa

`copiaLista` exige las tres cosas:

1. `LECTURA_COPIA=1` en Vercel.
2. Las tres últimas reconciliaciones de cada tabla cuadraron.
3. El webhook de cada tabla existe y no ha vencido.

Si falta cualquiera, o si la lectura falla, todo sigue leyendo de Airtable como antes. Para volver atrás basta con quitar la variable.

## Lo que no cambia

- Las tablas de los módulos (Operación, Limpiezas, Cobros) siguen leyendo de Airtable con la caché de 60 segundos. Sus filtros son fórmulas de Airtable, y pasarlos a Postgres es una entrega aparte.
- Las escrituras siguen por la cola, con "gana Airtable".

## Costo

- La reconciliación nocturna trae las cuatro tablas completas: unas pocas decenas de llamadas por noche, a menos de 5 por segundo por base.
- A cambio, cada carga de Inicio o de un módulo con alertas deja de hacer hasta 5 llamadas a Airtable.
