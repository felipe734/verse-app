import { describe, expect, it } from "vitest";
import { exigir, leerEntorno } from "@/lib/entorno";

describe("entorno", () => {
  it("acepta un entorno vacío porque las variables llegan por entrega", () => {
    expect(leerEntorno({})).toEqual({});
  });

  it("rechaza una DATABASE_URL que no es URL", () => {
    expect(() => leerEntorno({ DATABASE_URL: "no-es-url" })).toThrow();
  });

  it("exigir avisa qué variable crear sin mostrar valores", () => {
    expect(() => exigir(leerEntorno({}), "AIRTABLE_TOKEN")).toThrow(
      "Falta la variable AIRTABLE_TOKEN. Créala en Vercel.",
    );
  });
});
