import { describe, expect, it } from "vitest";
import { formulaCruza, formulaDentro, leerPeriodo } from "@/lib/vistas/periodo";

const HOY = "2026-11-23";

describe("período de las vistas", () => {
  it("por defecto es lo actual", () => {
    expect(leerPeriodo("mes", undefined, HOY)).toMatchObject({ clave: "2026-11", inicio: "2026-11-01", fin: "2026-12-01", etiqueta: "noviembre 2026", anterior: "2026-10", siguiente: "2026-12", actual: true });
    expect(leerPeriodo("semana", "basura", HOY)).toMatchObject({ clave: "2026-W48", inicio: "2026-11-23", fin: "2026-11-30", actual: true });
    expect(leerPeriodo("dia", undefined, HOY)).toMatchObject({ clave: HOY, etiqueta: "lunes 23 de noviembre", siguiente: "2026-11-24" });
  });

  it("navega meses, semanas y cruces de año", () => {
    expect(leerPeriodo("mes", "2026-12", HOY)).toMatchObject({ fin: "2027-01-01", siguiente: "2027-01", actual: false });
    expect(leerPeriodo("mes", "2026-01", HOY).anterior).toBe("2025-12");
    expect(leerPeriodo("semana", "2026-W01", HOY)).toMatchObject({ inicio: "2025-12-29", anterior: "2025-W52" });
    expect(leerPeriodo("semana", "2026-W48", HOY).etiqueta).toBe("23 al 29 de noviembre");
  });

  it("las fórmulas comparan el día de Bogotá como número", () => {
    const p = leerPeriodo("mes", "2026-11", HOY);
    expect(formulaDentro("Fecha", p)).toContain(">= 20261101");
    expect(formulaDentro("Fecha", p)).toContain("< 20261201");
    expect(formulaCruza("Ingreso", "Salida", p)).toContain("{Salida} = BLANK()");
  });
});
