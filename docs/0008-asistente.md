# 0008 · Asistente

Fecha: 2026-11-23

Modelo: `claude-sonnet-5-5` por defecto y `claude-opus-5-5` para cierres y diagnósticos, como fija el doc del plan. Esfuerzo `medium` (chat). Respaldo del servidor ante rechazos activado (`server-side-fallback-2026-07-01`, `fallbacks: "default"`): si un clasificador de seguridad rechaza, la API reintenta en otro modelo dentro de la misma llamada.

Superficie: API de Messages con un ciclo propio en nuestro servidor (no Managed Agents), porque las herramientas tienen que pasar por la base y la función de permisos de la app. El ciclo es manual (no el Tool Runner) para mandar el texto a la pantalla mientras llega, guardar el costo de cada respuesta y convertir lo irreversible en tarjetas. Maneja `refusal`, `pause_turn` y `max_tokens`; todos los resultados de herramientas van en un solo mensaje. Cada herramienta valida su entrada con zod (las entradas llegan en vivo con `eager_input_streaming`).

Historia: se guarda cada respuesta tal como la devuelve la API y se reenvía sin cambios (los bloques de razonamiento solo sirven así). Instrucciones y herramientas fijas con `cache_control`; la fecha y la pantalla van en el mensaje de la persona para no romper la caché.

Permisos: la casilla Asistente de cada empresa (no, consultas, consultas y acciones) decide si aparece y qué puede hacer; cada herramienta usa la función única de permisos con el acceso de quien pregunta.

Lo irreversible: las herramientas `proponer_*` nunca escriben. Crean una propuesta (`propuestas`) que la pantalla muestra como tarjeta; al confirmar, se vuelve a revisar el permiso y se ejecuta por la misma vía de Hoy (cola, autor, auditoría).

Herramientas de esta primera parte: buscar pendientes, resumen de Hoy, proponer cambio de pendiente (cerrar, aplazar, descartar), proponer pendiente nuevo, buscar unidades.

Costo: cada respuesta guarda tokens y costo (`mensajes_asistente`); Sistema muestra preguntas, costo de 7 días y costo por pregunta.

Pantalla: botón Asistente en todas las pantallas privadas; panel a la derecha en computador y hoja completa en celular; dictado con el reconocimiento de voz del navegador (es-CO); sabe la ruta y el pendiente abierto.

Variable en Vercel: `ANTHROPIC_API_KEY`. Sin ella el asistente no aparece.
