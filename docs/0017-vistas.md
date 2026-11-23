# 0017 · Vistas: período, filtros, tablero y cifras

Primer PR del plan de vistas, aprobado por Felipe el 2026-11-23.

## Reglas

- **Toda vista abre en lo actual.** Cada módulo declara su período (`periodo` en `DefTabla`): día, semana o mes, y la fecha que cae en él. Con `campoFin`, cuenta si el rango [campo, campoFin] se cruza con el período: así una reserva o un contrato activo en el mes aparece aunque haya empezado antes. ‹ › mueven el período y "Este mes" o "Esta semana" vuelve a lo actual. El período vive en `?p=` (2026-11, 2026-W48 o 2026-11-23).
- La consulta a Airtable trae solo el período. La fórmula compara el día de Bogotá como número AAAAMMDD (`lib/vistas/periodo.ts`).
- **Filtros en chips** (`filtros`): muestran los valores que aparecen en el período y quedan en la URL (`?f.Estado=Pendiente`). Solo aparecen los de columnas que la persona puede ver.
- **Tablero** (`tablero`): una columna por valor, normalmente Estado.
- **Cifras** (`indicadores`): se calculan sobre lo filtrado. Una suma de montos no aparece si la persona no tiene la casilla de cifras.
- **Vistas guardadas por persona**, en la tabla `vistas_guardadas`. Guardan los filtros y el tipo de vista, nunca el período, para que siempre abran en lo actual.
- **La última vista** que la persona usó en un módulo se recuerda en ese navegador. Es una comodidad: si no hay almacenamiento local, no pasa nada.

## Períodos por módulo

| Módulo | Período | Campo |
|---|---|---|
| Operación | Mes | Reservas que se cruzan (Ingreso a Salida) |
| Limpiezas | Semana | Fecha |
| Liquidaciones | Mes | Fecha |
| Comercial Host y Living | Mes | Fecha de llegada |
| Contratos | Mes | Activos en el mes (inicio a fin) |
| Cobros | Mes | Fecha |
| Equipo | Semana | Ingreso |
| Actas | Mes | Fecha |
| Pagos de obra | Mes | Fecha de pago |
| Calidad | Mes | Fecha de toma |
| Finanzas: Movimientos, Cruces, Caja menor, Caja global y Fondeos | Mes | Fecha |
| Finanzas: Overhead | Mes | Mes (texto AAAA-MM) |
| Finanzas C&C: Pagos | Mes | Fecha de emisión |

Unidades Host, Unidades Living, Alistamiento y Contratistas no tienen período: son listas vigentes con filtros, tablero y cifras.

En Finanzas, el cierre de arriba es el del mes elegido. Si ese mes todavía no tiene cierre (se llena el día 5 del mes siguiente), muestra el último cerrado.

## Calendario y agenda (segundo PR)

- **Operación abre en un calendario tipo Airbnb:**
  - Una fila por unidad con reservas en el mes y una columna por día.
  - Cada reserva es una barra de la tarde de llegada a la mañana de salida, con un color por plataforma.
  - En el mes actual, arriba aparecen "Llegan hoy" y "Salen hoy", y la ocupación de las unidades con reservas.
  - Al tocar una barra se abre el detalle.
  - En celular se ve como agenda de llegadas y salidas por día.
- **Limpiezas abre en una agenda semanal:** una fila por funcionaria y una columna por día, con la hora y la unidad. Lo terminado sale atenuado. En celular se ve como lista por día.
- Lista y Tablero siguen disponibles en los dos módulos. La vista inicial de cada módulo es `vistaInicial`.

## Living (tercer PR)

- **Contratos** abre en el calendario del mes: unidades por días, con una barra por contrato coloreada por estado, "Empiezan hoy", "Terminan hoy" y la ocupación del mes. Las cifras son contratos en el mes, sin firmar y canon.
- **Cobros** abre en tablero por estado (POR PAGAR y PAGO), con cobrado y por cobrar del mes.
- **Unidades Living** abre en tablero por estado (Actual, Salida, Futuro, Vacío, Pasado), con ocupadas, con salida y vacías.
- Las cifras de suma aceptan `donde`, para sumar solo un estado.
- La ocupación del calendario cuenta cada noche una sola vez aunque dos registros se pisen.

## Resto de módulos (cuarto PR)

- **Unidades Host**: tablero por edificio.
- **Liquidaciones**: tablero por estado.
- **Alistamiento**: tablero por estado del pedido.
- **Comercial Host**: embudo por estado del lead.
- **Actas (Obra)**: tablero por contratista para el corte del mes.
- **Equipo**: agenda de la semana con las horas de cada turno por funcionaria.
- **Finanzas**: debajo del cierre, las barras de ingresos y margen neto de los últimos seis meses, con una tabla para lectores de pantalla.
