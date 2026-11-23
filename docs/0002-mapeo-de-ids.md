# 0002 · Mapeo de IDs de Airtable

Fecha: 2026-11-22

`lib/airtable/definicion.ts` dice, por nombre, qué tablas sincroniza la app y qué campos usa. `pnpm mapeo:generar` lee el CATÁLOGO DE DATOS y los esquemas vivos de Airtable (solo lectura) y escribe `lib/airtable/mapeo.ts` con los IDs. El código usa solo `mapeo.ts`.

El único ID escrito a mano es el punto de arranque: dónde vive el catálogo (9. VERSE OS / CATÁLOGO DE DATOS).

Pruebas:
- `tests/unit/mapeo.test.ts` revisa formato y coherencia del archivo generado en cada PR.
- `tests/vivo/mapeo.vivo.test.ts` falla si un ID de base, tabla o campo ya no existe en Airtable. Corre en CI con el secreto `AIRTABLE_TOKEN` en cada PR y cada mañana a las 6:00.

Hallazgo: una base duplicada conserva los IDs de tabla. EXTRACTOS tiene `tbliH16mURmOImzSc` en 1. VL PRIVADO y en 2. CONTABILIDAD. La clave de una tabla es siempre base + tabla.

UNIDADES: la app usa las de 5. INVENTARIO (Host) y 7. LIVING. Las demás tablas UNIDADES son syncs de 5. INVENTARIO.
