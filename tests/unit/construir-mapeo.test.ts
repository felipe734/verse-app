import { describe, expect, it } from "vitest";
import { construirMapeo, ErrorMapeo, type FilaCatalogo } from "@/lib/airtable/construir-mapeo";

const fila = (p: Partial<FilaCatalogo>): FilaCatalogo => ({
  tabla: "TAREAS",
  workspace: "Verse",
  base: "BASE PRUEBA",
  idBase: "appAAAAAAAAAAAAAA",
  idTabla: "tblAAAAAAAAAAAAAA",
  origen: "Propia",
  uso: "Manual",
  ...p,
});

const definicion = {
  tareas: { base: "BASE PRUEBA", tabla: "TAREAS", campos: { asunto: "Asunto" } },
};

const esquemas = {
  appAAAAAAAAAAAAAA: [
    {
      id: "tblAAAAAAAAAAAAAA",
      name: "TAREAS",
      fields: [{ id: "fldAAAAAAAAAAAAAA", name: "Asunto", type: "singleLineText" }],
    },
  ],
};

describe("construirMapeo", () => {
  it("resuelve nombres a IDs desde el catálogo y el esquema", () => {
    const m = construirMapeo([fila({})], esquemas, definicion);
    expect(m.tablas.tareas?.idTabla).toBe("tblAAAAAAAAAAAAAA");
    expect(m.tablas.tareas?.campos.asunto).toEqual({
      id: "fldAAAAAAAAAAAAAA",
      nombre: "Asunto",
      tipo: "singleLineText",
    });
  });

  it("falla si la tabla no está en el catálogo", () => {
    expect(() => construirMapeo([], esquemas, definicion)).toThrow(ErrorMapeo);
  });

  it("falla si la tabla del catálogo ya no existe en Airtable", () => {
    expect(() => construirMapeo([fila({ idTabla: "tblZZZZZZZZZZZZZZ" })], esquemas, definicion)).toThrow(
      /no existe en Airtable/,
    );
  });

  it("falla si un campo cambió de nombre o se borró", () => {
    const sinCampo = { appAAAAAAAAAAAAAA: [{ ...esquemas.appAAAAAAAAAAAAAA[0]!, fields: [] }] };
    expect(() => construirMapeo([fila({})], sinCampo, definicion)).toThrow(/"Asunto" aparece 0 veces/);
  });

  it("rechaza IDs mal formados en el catálogo", () => {
    expect(() => construirMapeo([fila({ idBase: "app123" })], esquemas, definicion)).toThrow(/ID inválido/);
  });
});
