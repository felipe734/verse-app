import { describe, expect, it } from "vitest";
import { esMio } from "@/lib/vistas/mio";

describe("lo mío", () => {
  it("reconoce a la persona aunque Airtable escriba distinto su nombre", () => {
    expect(esMio("Edy Borrre", "Edy Borre")).toBe(true);
    expect(esMio("Edy", "Edy Borre")).toBe(true);
    expect(esMio("María Sanchez", "maria sánchez")).toBe(true);
    expect(esMio("Anabel Ruiz", "Ana")).toBe(false);
    expect(esMio("", "Ana")).toBe(false);
    expect(esMio("Ana", null)).toBe(false);
  });
});
