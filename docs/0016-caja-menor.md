# 0016 · Crear gastos de caja menor

Segunda parte del plan de edición, aprobado por Felipe el 2026-11-23.

## Qué hace

- En Finanzas aparece "Nuevo gasto" en la pestaña Caja menor de Verse (3. ADMIN / CAJA MENOR VERSE) y en la pestaña Caja de C&C (4. CAJA MENOR / MOVIMIENTOS C&C).
- Lo ve quien tiene Finanzas en "editar" y la casilla de cifras de General. La plantilla Administrador Verse tiene Finanzas en "ver", así que hoy solo el Maestro registra gastos. Para que Diana los registre, se sube Finanzas a "editar" en Ajustes.
- Campos de Verse: concepto, valor, fecha (hoy por defecto), persona, apto y foto del soporte.
- Campos de C&C: concepto, valor (Egreso), fecha, tipo, tercero, NIT o cédula, responsable, tipo de soporte, foto y comentario.
- El Estado no se escribe: lo maneja quien concilia.
- Las opciones de los selects salen del esquema vivo y los IDs, del mapeo. El monto se guarda como número.
- Todo pasa por la cola y queda en AUDITORIA.

## Soporte

El almacén es privado y conectado por OIDC (`BLOB_STORE_ID`). La subida usa una URL firmada y Airtable recibe una URL de lectura firmada por 24 horas (`lib/servidor/blob.ts`).

- La foto o el PDF van directo del celular a Vercel Blob, con un token que solo da `/api/finanzas/soporte` a quien edita Finanzas de esa empresa.
- Solo acepta imagen o PDF, de hasta 15 MB, y el nombre del archivo lleva un sufijo aleatorio.
- La URL pasa a Airtable, que guarda su propia copia.
- Sin `BLOB_READ_WRITE_TOKEN`, el gasto se guarda sin foto y el formulario lo dice.
