# 0028 · Firma por verse-docs

Fase 2.3. Desde el detalle de un contrato en Contratos: "Revisar para firma" y, si sale OK, "Enviar a firma" (solo Felipe).

## Flujo

1. La app descarga el PDF de CONTRATO › Contrato y se lo pasa a verse-docs (`POST /api/revisar`, con `Bearer VERSE_DOCS_TOKEN`).
2. verse-docs lo compara con el modelo aprobado y registra la revisión en FIRMAS.
   - Con alerta: queda Bloqueado en FIRMAS y la automatización de Airtable le escribe a Felipe. La app muestra los hallazgos y no da opción de enviar.
   - Con OK: verse-docs devuelve un token que solo sirve para ese mismo PDF durante 24 h.
3. Solo el Maestro ve "Enviar a firma". Confirma por WhatsApp o "Solo enlaces", y la app llama a `POST /api/enviar` con `contratoRecordId`.
4. La app anota en CONTRATO: Auco Code, Auco Estado Enviado y Auco Log con quién y cuándo. Queda en AUDITORIA (`contratos.revisado`, `contratos.enviado_a_firma`).
5. Cuando Auco termina, el webhook de verse-docs pone Estado Firmado y deja el PDF firmado en UNIDADES › Contrato Arriendo. La app no toca Auco.

## Variables

- `VERSE_DOCS_TOKEN`: el mismo valor de `VERSE_API_TOKEN` de verse-docs. Sin ella, el botón responde "Falta conectar verse-docs".
- `VERSE_DOCS_URL`: opcional. Por defecto es https://docs.verseliving.com.

## Pendientes fuera del repo

- verse-docs solo tiene aprobado el modelo `vl-coliving`. Para firmar apartamentos hay que sincronizar `vl-vivienda-living` y `vl-vivienda-balcony` en `verse-docs/modelos`. Sin eso, la revisión los bloquea por "sin modelo".
- verse-docs registra en FIRMAS las llamadas con token como "Felipe (Claude)". Para que diga "Verse App" y el nombre de la persona hace falta un cambio en verse-docs.
