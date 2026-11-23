# 0011 · Módulos de tabla (entrega 5)

Fecha: 2026-11-23

Los módulos del equipo se declaran en el registro como módulos de tabla (`lib/modulos/tablas-equipo.ts`): tabla de Airtable, columnas, detalle, ventana de fechas y orden. Una sola pantalla genérica (`components/modulos/tabla`) los muestra: lista densa con filtro, orden por columna y detalle en panel lateral.

Lectura: en el momento, con `consultar` (cellFormat string, zona Bogotá), solo de los campos que la persona puede ver. No se copian tablas completas a Postgres ni se crean webhooks: el plan pide leer al abrir el módulo y sincronizar solo los campos que se usan. Las llamadas cuentan en la medición de Sistema.

Sensibles: cada columna de dinero se marca `cifras`, los datos de personas `terceros` y los códigos `codigos`. Sin la casilla, el campo ni se pide a Airtable. "Solo en su turno" no abre códigos en listas (eso es de Ruta de aseo, entrega 6). Credenciales de plataformas (RNT, FONTUR) y cuentas bancarias de propietarios y contratistas no se piden nunca; una prueba lo vigila.

Nombres de campo: revisados contra el esquema de Airtable el 2026-11-23. La prueba en vivo `tests/vivo/tablas.vivo.test.ts` falla si alguno cambia.

Construidos: Operación, Limpiezas, Unidades Host, Liquidaciones, Alistamiento, Comercial Host, Unidades Living, Contratos, Cobros, Comercial Living, Equipo (control de horas), Actas, Pagos de obra, Contratistas y Calidad. Quedan sin construir: Finanzas de Verse y de C&C, Balcony PH, Diseño y compras y Ruta de aseo.

Solo lectura en esta etapa: editar desde estas pantallas entra después, por la cola y con AUDITORIA.
