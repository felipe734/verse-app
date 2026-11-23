# 0018 · Plan de mejoras (aprobado por Felipe el 2026-11-23)

Regla general: **todo abre en lo actual y en lo tuyo**.

## 1. "Lo mío" por defecto

- Los módulos que tienen un campo de persona lo declaran en `persona` de `DefTabla`: Limpiezas (Funcionario), Equipo (Funcionaria), Comercial Host (SDR) y Caja menor de Verse (Persona).
- Quien tiene alcance "lo suyo" en su plantilla abre en **Mío**. El Maestro y quien tiene alcance "todo" abren en **Todo**. El interruptor cambia entre los dos y deja `?quien=` en la URL solo cuando no es el valor por defecto.
- La persona se reconoce por su Nombre en Airtable, sin tildes ni mayúsculas y por su primer nombre, porque en Airtable el mismo nombre aparece escrito de varias formas (`lib/vistas/mio.ts`).
- Es un filtro de comodidad, no de permisos: quien tiene el módulo puede ver Todo.

## 2. Caché de 60 segundos

- Las lecturas de los módulos pasan por `consultarCacheado` (`lib/servidor/cache-airtable.ts`, `"use cache"` de Next) durante 60 segundos, con la etiqueta `airtable:<tabla>`.
- La clave es la consulta exacta, con sus campos. Cada nivel de acceso pide campos distintos, así que nadie recibe de la caché un campo que su casilla no abre.
- Cada escritura por la cola vence la caché de su tabla. En una acción del servidor, la persona ve su cambio de inmediato.
- El botón **Actualizar** de cada módulo vence la caché a mano.
- La Ruta de aseo lee siempre directo de Airtable (`fresco`), porque el turno y el reporte no pueden llegar con un minuto de retraso.
- Solo las lecturas que llegan a Airtable se cuentan en Sistema.
- Para apagar la caché en una emergencia: `APP_SIN_CACHE=1` en Vercel.
- En la vitrina de pruebas no hay caché. Su efecto real se ve en producción.

## 3. Acciones de un toque y tablero que se arrastra

- `rapidas` en `DefTabla` pone un valor en un campo editable con un toque. Se ofrece solo si la fila no lo tiene ya y si la persona tiene el módulo en editar:
  - Limpiezas: Terminada.
  - Cobros: Pagado.
  - Contratos: Firmado.
  - Movimientos: Conciliado.
- Aparece como botón en el detalle y como ✓ en cada tarjeta de la agenda de Limpiezas.
- En el tablero, si su columna es un campo editable (Estado), arrastrar una tarjeta a otra columna cambia el valor.
- Todo pasa por `cambiarRapido`, que valida la opción contra Airtable y escribe por la cola con el valor que se veía: si Airtable cambió, gana Airtable.
- En celular, arrastrar no está disponible. Se usa el botón del detalle.

## 4. Celular y avisos

- En celular, las listas se ven como tarjetas: el título, el estado y hasta tres datos con su nombre, en vez de una tabla con columnas escondidas. Los filtros se deslizan de lado en una sola línea.
- Avisos: las claves VAPID ya están en Vercel, así que los avisos de críticos, aprobaciones y fallas salen con el cron de la noche y con los cambios de TRAZABILIDAD. Un aviso de "tu ruta de hoy" a las 6 a. m. necesita un tercer cron, y el plan Hobby de Vercel permite dos. Queda pendiente hasta pasar a Pro o mover un cron.

## 5. Detalle con relacionados

- `relacionados` en `DefTabla` declara bloques de otros módulos que se cargan al abrir el detalle (`lib/modulos/relacionados.ts`). Cada bloque se lee con los permisos de la persona: si no ve ese módulo, el bloque no aparece, y sin cifras no hay montos.
- La búsqueda es por texto sobre el campo relacionado: `FIND(valor, ARRAYJOIN({campo}))`. Sirve para texto y para enlaces, que Airtable devuelve como nombres. Si el mismo nombre de unidad está escrito distinto en dos bases, el bloque sale vacío.
- Relaciones de cada módulo:
  - Reserva: limpiezas y liquidaciones de la unidad.
  - Limpieza: reservas de la unidad.
  - Unidad Host: reservas, limpiezas y liquidaciones.
  - Liquidación: reservas.
  - Unidad Living: contratos y cobros.
  - Contrato: cobros.
  - Cobro: contrato.
  - Acta: pagos del contratista.
  - Pago de obra: actas.
  - Contratista: actas y pagos.

## 6. ⌘K global y actividad por registro

- **⌘K** también busca, por el nombre de la fila y sin importar el período, en Contratos, Cobros, Actas, Contratistas, Comercial Host y Living y Liquidaciones, siempre que la persona vea el módulo. El resultado abre el módulo en el período de la fila (`?p=`), en lista y Todo, con la fila abierta (`?fila=`).
- **Actividad**: el detalle muestra quién cambió qué y cuándo desde la app (AUDITORIA, con nombres de campo legibles). Lo que se cambió a mano en Airtable o hizo una skill no aparece aquí.

## 7. Exportar y atajos

- **Exportar** en cada módulo:
  - CSV para Excel con las mismas columnas, filtros y período que se ven, con tildes correctas. Se arma en el navegador con lo que la persona ya ve, así que no saca nada nuevo del servidor.
  - "Imprimir o guardar PDF" usa la impresión del navegador, sin barra lateral ni controles.
- **Atajos de teclado**, que no actúan mientras se escribe:
  - `/` filtra.
  - `[` y `]` mueven el período y `H` vuelve a lo actual.
  - `1` a `4` cambian la vista.
  - `?` muestra la ayuda.
  - Se suman a ⌘K (buscar) y ⌘J (asistente).

## 8. Alertas de la operación

`lib/alertas/operacion.ts` calcula, con lecturas de Airtable que pasan por la caché, lo que hoy solo aparece en los briefs:

| Alerta | Nivel | Módulo |
|---|---|---|
| Salidas de los próximos 3 días sin limpieza esa fecha | Alta | Limpiezas |
| Limpiezas de los próximos 7 días sin funcionaria | Alta | Limpiezas |
| Cobros POR PAGAR con fecha pasada | Alta | Cobros |
| Contratos que terminan en 30 días | Media | Contratos |
| Movimientos de 45 días por identificar o sin soporte | Media | Finanzas |

- Cada alerta solo sale para quien ve el módulo. No trae montos.
- Aparecen arriba en Inicio y en la cabecera de su módulo, con enlace al lugar donde se resuelven, ya filtrado cuando se puede.
- Cada módulo consulta solo sus propias alertas.
