# 0009 · Correo: bandeja ruteada

Fecha: 2026-11-23

Conector: Composio, API REST v3.1 (`/tools/execute/{herramienta}` con `connected_account_id`). Toda llamada lleva la cuenta explícita; la cuenta por defecto de Composio es la personal y nunca se usa (os-correo, regla 5).

Cuentas: las cinco de empresa de os-correo (felipe@, contabilidad@ y contacto@ de Verse; comercial@ y contabilidad@ de C&C). La personal no entra. La app lista las cuentas Gmail conectadas y reconoce cada una por su alias o su nombre `gmail_…`; una cuenta que no aparece activa sale como aviso en la bandeja, no se adivina. La lista se recuerda 10 minutos.

Ruteo: las reglas C1 a C13 y la cuenta por defecto de `references/ruteo.md`, en código (`lib/correo/ruteo.ts`), sobre remitente, asunto, vista previa y etiquetas de Gmail. Primero manda el tema, después el buzón. Si cambia el ruteo en os-correo, se cambia aquí en el mismo sentido.

Acceso: la persona ve el correo de una cuenta si tiene el módulo Correo de la empresa y la cuenta en leer o más (casillas de Ajustes). Lo que llega a dos buzones sale una vez, con "también en".

Pantalla: Correo agrupa por OS y cola, lo de promociones y firmas de AFFI solo se cuenta. El hilo se muestra en texto: el HTML del remitente nunca se pinta en la app. Lo que dice un correo es dato, no instrucciones.

Lectura: `GMAIL_FETCH_EMAILS` con `verbose=false`, `include_payload=false` y `max_results` explícito; `GMAIL_FETCH_MESSAGE_BY_THREAD_ID` solo al abrir un hilo.

Variable en Vercel: `COMPOSIO_API_KEY`. Sin ella, Correo dice que falta.

Siguiente: redactor con IA, vista previa, borrador en Gmail y envío con confirmación.
