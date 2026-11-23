# 0014 · Ruta de aseo

Entrega 6. Plan aprobado por Felipe el 2026-11-23.

## Airtable (6. OPERACION 360)

Los nombres de las funcionarias no coinciden entre tablas: "Edy Borrre" en LIMPIEZA, "Edy Borre" en SERVICIOS y "Edy" en CONTROL HORAS. Por eso:
- Se creó la tabla FUNCIONARIAS con Nombre, Activa, Correo y la opción exacta de cada tabla.
- LIMPIEZA, SERVICIOS y CONTROL HORAS ganaron el campo "Funcionaria enlace", lleno desde el 1 de noviembre.
- Los selects viejos siguen igual. La app escribe en los dos (el enlace y la opción de esa tabla), así que las skills no se rompen.
- Las skills que cambian están en [felipe734/verse-plugins#81](https://github.com/felipe734/verse-plugins/pull/81).

Para escribir con IDs sin escribirlos a mano, el mapeo generado tiene ahora `ESCRITURA`: son tablas donde la app escribe pero que no se copian a Postgres. CI regenera el mapeo con el catálogo vivo y lo deja como artefacto.

## La pantalla

`/verse/host/ruta`. La funcionaria se reconoce por su Correo en FUNCIONARIAS o, si no, por su "Nombre en Airtable" en Ajustes (sin importar tildes).

- **Ruta del día:** las limpiezas de hoy enlazadas a ella, en orden de hora.
- **Turno:**
  - Iniciar crea la fila en CONTROL HORAS con la hora real y la nota "Turno desde Verse App".
  - Cerrar le pone la Salida.
  - No se pueden abrir dos turnos el mismo día.
- **Datos de ingreso:**
  - Con "Solo en su turno", el método, el código, el candado y el wifi solo salen con el turno abierto y para una limpieza de su ruta de hoy.
  - Cada apertura queda en AUDITORIA (`ruta.codigo_abierto`).
- **Reporte:**
  - Se envía con el turno abierto y crea la fila en SERVICIOS con: tipo de inventario, estado, video, daños y faltantes, implementos, lavandería y comentario.
  - Si la unidad queda lista, la limpieza pasa a Terminado.
- **Video:**
  - Va directo del celular a Vercel Blob, con un token que solo da `/api/ruta/video` a quien opera la ruta.
  - Solo acepta video, de hasta 500 MB, y el nombre del archivo lleva un sufijo aleatorio.
  - La URL pasa a SERVICIOS y Airtable guarda su propia copia.
  - Sin `BLOB_READ_WRITE_TOKEN`, el reporte sale sin video y la pantalla lo dice.
- **Quien coordina** (sin fila en FUNCIONARIAS) ve las rutas de hoy de todas las funcionarias activas, sin acciones.
- Quien no tiene Hoy (aseo) entra directo a su primera pantalla en vez de "Sin acceso".

## Pendiente de Felipe

- Crear un almacenamiento Blob en Vercel y conectarlo al proyecto. Eso crea `BLOB_READ_WRITE_TOKEN`.
- Invitar a Edy, Sara, María y Yoleida con la plantilla Aseo. El "Nombre en Airtable" de cada una debe ser su Nombre en FUNCIONARIAS, o se pone su correo en FUNCIONARIAS. Marcar Activa a quien trabaja hoy.
- Cuando la usen, apagar los formularios de hoy.
