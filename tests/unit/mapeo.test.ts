import { describe, expect, it } from "vitest";
import { CATALOGO, TABLAS } from "@/lib/airtable/mapeo";
import { TABLAS_SINCRONIZADAS } from "@/lib/airtable/definicion";

describe("mapeo generado", () => {
  it("tiene una tabla mapeada por cada tabla definida", () => {
    expect(Object.keys(TABLAS).sort()).toEqual(Object.keys(TABLAS_SINCRONIZADAS).sort());
  });

  it("cada tabla sincronizada está en el catálogo con el mismo ID", () => {
    for (const t of Object.values(TABLAS)) {
      expect(CATALOGO.some((f) => f.idBase === t.idBase && f.idTabla === t.idTabla)).toBe(true);
    }
  });

  // Una base duplicada conserva los IDs de tabla (EXTRACTOS en 1. VL PRIVADO y 2. CONTABILIDAD),
  // así que la clave única es base + tabla.
  it("no repite el par base y tabla en el catálogo", () => {
    const ids = CATALOGO.map((f) => `${f.idBase}/${f.idTabla}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todos los campos definidos tienen ID con formato de Airtable", () => {
    for (const [clave, def] of Object.entries(TABLAS_SINCRONIZADAS)) {
      const t = TABLAS[clave as keyof typeof TABLAS];
      for (const c of Object.keys(def.campos)) {
        expect((t.campos as Record<string, { id: string }>)[c]?.id).toMatch(/^fld[A-Za-z0-9]{14}$/);
      }
    }
  });
});
