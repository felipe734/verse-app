# 0036 · Living y firma dentro de la app (rediseño R7)

Decisión de Felipe del 2026-11-25: la firma de los contratos que genera la app queda dentro de Verse App, sin verse-docs. El PR #69 (firma por verse-docs) se cerró sin fusionar.

## Generación de contratos

- El módulo Contratos de Living pasa a llamarse **Generación de contratos**. La migración 0012 lo renombra en Postgres solo si nadie lo cambió en Ajustes.
- Columnas: unidad, arrendatario, estado, firma, inicio, fin y edificio.
- Cifras: por elaborar, por firmar y firmados.
- El detalle trae el PDF (Abrir), la revisión del documento y el botón **Firma**.

## Firma (lib/firma)

1. "Firma" muestra quién firma y en qué orden:
   - el residente, con documento, cara y código por WhatsApp;
   - después C&C GROUP SAS (Juan Felipe Tobar), con código por correo.
2. Solo el Maestro ve **Enviar por WhatsApp** y **Solo crear enlaces**. Al enviar, la app:
   - descarga el PDF de CONTRATO › Contrato, saca su huella SHA-256 y agrega la página de firmas (pdf-lib, portada de verse-docs);
   - crea la fila en FIRMAS (Resultado OK, Subido por "Verse App · nombre", Hash) con la nota de que no lleva revisión con IA;
   - crea el proceso en Auco con `custom.contratoRecordId` y `firmaRecordId`;
   - anota Auco Code, Auco Estado Enviado y Auco Log en CONTRATO, y el estado en FIRMAS;
   - deja `contratos.enviado_a_firma` en AUDITORIA.
3. No hay segunda revisión con IA: el contrato sale del modelo aprobado y Haiku ya validó la cédula al generarlo.
4. **Aviso de Auco** en `/api/auco/webhook`. El encabezado `x-verse-webhook` sale de la llave privada, así que no hace falta otra variable. Con cada aviso, la app consulta el estado real en Auco y:
   - actualiza FIRMAS (estado y log);
   - actualiza CONTRATO (Auco Estado; Estado Firmado al terminar);
   - deja el PDF firmado de primero en UNIDADES › Contrato Arriendo, sin borrar los anteriores.

## Lo que necesita Felipe

- En Vercel de verse-app, las mismas variables que hoy tiene verse-docs: `AUCO_ENV` (stage o prod), `AUCO_PUK`, `AUCO_PRK` y `FIRMANTE_CELULAR`.
  - Opcionales: `AUCO_CREADOR_EMAIL` y `PUBLIC_HOST`.
  - `VERSE_DOCS_TOKEN` ya no hace falta.
- Ajustes › Conexiones › **Conectar aviso**, una sola vez y cuando no haya contratos esperando firma en verse-docs. Desde ese momento, Auco avisa a la app en lugar de a verse-docs.
