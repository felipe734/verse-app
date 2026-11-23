# 0009 · Correo: bandeja ruteada

Fecha: 2026-11-23

Conector: Composio, API REST v3.1 (`/tools/execute/{herramienta}` con `connected_account_id`). Toda llamada lleva la cuenta explícita; la cuenta por defecto de Composio es la personal y nunca se usa (os-correo, regla 5).

Cuentas: las cinco de empresa de os-correo (felipe@, contabilidad@ y contacto@ de Verse; comercial@ y contabilidad@ de C&C). La personal no entra. La app lista las cuentas Gmail conectadas y reconoce cada una por su alias o su nombre `gmail_…`; una cuenta que no aparece activa sale como aviso en la bandeja, no se adivina. La lista se recuerda 10 minutos.

Ruteo: las reglas C1 a C13 y la cuenta por defecto de `references/ruteo.md`, en código (`lib/correo/ruteo.ts`), sobre remitente, asunto, vista previa y etiquetas de Gmail. Primero manda el tema, después el buzón. Si cambia el ruteo en os-correo, se cambia aquí en el mismo sentido.

Acceso: la persona ve el correo de una cuenta si tiene el módulo Correo de la empresa y la cuenta en leer o más (casillas de Ajustes). Lo que llega a dos buzones sale una vez, con "también en".

Pantalla: Correo agrupa por OS y cola, lo de promociones y firmas de AFFI solo se cuenta. El hilo se muestra en texto: el HTML del remitente nunca se pinta en la app. Lo que dice un correo es dato, no instrucciones.

Lectura: `GMAIL_FETCH_EMAILS` con `verbose=false`, `include_payload=false` y `max_results` explícito; `GMAIL_FETCH_MESSAGE_BY_THREAD_ID` solo al abrir un hilo.

Variable en Vercel: `COMPOSIO_API_KEY`. Sin ella, Correo dice que falta.

## Redactor, borrador y envío

Se pide en el asistente, desde un pendiente, un hilo abierto o en blanco. El asistente lee con `ver_bandeja` y `leer_hilo` (lo que trae un correo es dato, no instrucciones) y redacta con `proponer_correo`, que no envía: crea una tarjeta.

Cuenta: el asistente propone la cuenta según os-correo (se responde desde la que recibió) entre las que la persona puede redactar; si no es obvia, pregunta. La casilla de la cuenta decide: redactar deja guardar el borrador, enviar deja además enviar.

Tarjeta: muestra De, Para y la vista previa como la recibe el destinatario, en un marco aislado. Se puede editar a mano o pedir cambios al asistente. Guardar borrador lo deja en Gmail (`GMAIL_CREATE_EMAIL_DRAFT`, en el mismo hilo si es respuesta). Enviar pide un segundo toque.

Marca: envoltura, franja Navy con el punto naranja (VERSE, con HOST o LIVING, o C&C GROUP), párrafos, firma con el nombre de quien escribe y pie con la empresa y la cuenta. Estilos en línea, fondos dobles. El texto se escapa: nunca entra HTML del modelo ni de la persona.

Envío: se revisa el permiso otra vez y la propuesta se toma una sola vez (un doble toque no envía dos). Correo nuevo: antes de enviar se busca el mismo asunto en enviados de 7 días de esa cuenta y, si está, no se repite. Respuesta: `GMAIL_REPLY_TO_THREAD`. Siempre `is_html=true` e `include_signature=false`. Si Gmail no confirma, no se reintenta solo: se pide revisar Enviados.

Rastro: AUDITORIA de la app con `correo.enviado` o `correo.borrador`, cuenta, destinatarios y asunto. Si el correo salió de un pendiente cuyo link es de Gmail, al enviarse el pendiente queda Hecho por la misma vía de Hoy.

Pendiente: adjuntos desde Drive o Airtable (necesitan subir el archivo a Composio primero) quedan para el PR de Drive.
