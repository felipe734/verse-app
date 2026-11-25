# 0027 · Generador de contratos de Living

Fase 2.2. Contratos › "Nuevo contrato" arma el contrato desde la app con el modelo aprobado y lo deja en CONTRATO como Elaborado.

## Regla

La plantilla manda. La app no redacta: copia el modelo aprobado de verse-legal (`lib/contratos/modelos`, copia literal de `contratos/fuentes`) y solo reemplaza los campos `{{ }}`. Si falta un campo, no genera. Haiku no escribe nada del contrato: solo lee las fotos del documento.

## Flujo

1. Se elige la unidad (fila de UNIDADES de 7. LIVING sin contrato: `VL 301_03`, `VL H4_04`, `EB 402_01`) y el residente (DATOS sin contrato, últimos 120 días).
2. El modelo sale de la unidad:

   | Unidad | Modelo |
   |---|---|
   | `VL` + número | vl-vivienda-living |
   | `VL H` + número | vl-coliving |
   | `EB` + número | vl-vivienda-balcony |

3. La app trae de Airtable:
   - de UNIDADES: canon, administración, duración, referencia de pago, matrícula, ENEL y EAAB;
   - de DATOS: nombre, cédula, correo y celular.

   Se completan a mano el inicio, el lugar de expedición y el parqueadero.
4. Se calculan la fecha de terminación (inicio + meses, mismo día, como en CONTRATO), los valores en letras y las fechas largas (`lib/contratos/letras.ts`).
5. Haiku (`claude-haiku-5-5`) lee el frente y el reverso del documento en DATOS con una herramienta de salida fija. El código compara nombre (en cualquier orden), número y fecha de nacimiento.
   - Si algo no coincide, o no hay fotos, no se genera.
   - Solo el Maestro puede forzarlo, y queda anotado en Validación.
6. El PDF se arma con react-pdf: Gantari e IBM Plex Mono (OFL), formato de empresa de verse-legal, sin guiones de división para que el texto sea idéntico al modelo.
   - Se guarda en Vercel Blob (`contratos/`).
   - Llega a CONTRATO › Contrato con URL firmada de 24 h.
7. Se crea la fila en CONTRATO y se registra `contratos.generado` en AUDITORIA. La fila lleva:
   - Contrato_ID, Estado Elaborado, Edificio, Unidad, Nombre y fechas;
   - letras, días de preaviso, tipo de documento y Validación.

## Notas

- A Gantari se le quitó la tabla GSUB: las ligaduras "fi" descuadraban el texto en react-pdf (se perdía una letra por ligadura).
- Airtable (con OK de Felipe, 2026-11-24): campo Validación en CONTRATO. Los demás campos ya existían.
- La firma va en 2.3: revisión de verse-docs y envío a Auco con OK de Felipe. Hoy verse-docs solo tiene aprobado el modelo `vl-coliving`; hay que sincronizar vl-vivienda-living y vl-vivienda-balcony antes de mandar a firma un apartamento.
