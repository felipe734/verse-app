# 0034 · Finanzas (rediseño R5)

- **Mes anterior por defecto** en Movimientos, Cruces y Overhead. Todo eso se cruza con los extractos, que llegan cuando el mes cierra, así que el mes en curso aparece vacío.
  - Caja menor, Caja global y Fondeos siguen en el mes en curso.
  - La regla es `periodo.inicio: "anterior"` en lib/modulos/finanzas.ts, con `periodoInicial` de lib/vistas/periodo.ts.
- **Abrir en Drive:** botón por archivo (columna de tipo `enlace`, componente `BotonEnlace`) en la tabla y en el detalle.
  - Extractos, de Verse y de C&C: el archivo del extracto.
  - Reportes: el Link Drive y el archivo.
  - Movimientos: el soporte en Drive.

  Si el enlace es de Drive o Docs, el botón dice "Abrir en Drive"; si es un adjunto de Airtable, dice "Abrir".
