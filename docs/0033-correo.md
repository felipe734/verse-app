# 0033 · Correo (rediseño R4)

- **Para responder primero.** Haiku (`claude-haiku-5-5`) mira remitente, asunto y vista previa de lo que llegó y marca qué necesita atención y respuesta. Lo demás queda en **Informativo**, plegado.
  - Promociones y boletines siguen fuera de la lista, como antes (`ruido` de os-correo).
  - Cada mensaje se clasifica una vez mientras la función siga viva, a costo de centavos.
  - Sin clave de la API, o si Haiku falla, decide la regla de os-correo: se responde y el remitente no es automático (no-reply, Airbnb, facturación, boletines…).
- **Una fila de controles:** cuentas (Todas, felipe@, contabilidad@…), buscar y Redactar.
- **Lectura legible:** los correos en HTML se convierten a texto con párrafos, viñetas y enlaces "texto (url)" (lib/correo/texto.ts). Nunca se pinta el HTML del remitente: ni estilos, ni scripts, ni imágenes de rastreo.
- Aplica igual a Verse y a C&C.
