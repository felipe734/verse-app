import { describe, expect, it } from "vitest";
import { agrupar, numero } from "@/lib/modulos/tendencia";

describe("tendencia del año", () => {
  it("lee montos de Airtable en texto", () => {
    expect(numero("$1,234,567.00")).toBe(1234567);
    expect(numero("1.234.567")).toBe(1234567);
    expect(numero("$ 450.000,50")).toBe(450000.5);
    expect(numero("")).toBe(0);
  });
  it("suma por mes solo el año pedido", () => {
    const t = agrupar(
      [
        { fields: { Fecha: "3/1/2026", F: "$100.00" } },
        { fields: { Fecha: "20/1/2026", F: "$50.00" } },
        { fields: { Fecha: "5/11/2026", F: "$10.00" } },
        { fields: { Fecha: "5/12/2025", F: "$999.00" } },
      ],
      { fecha: "Fecha", series: [{ campo: "F", etiqueta: "Facturado" }] },
      "2026",
    );
    expect(t.meses[0]!.valores).toEqual([150]);
    expect(t.meses[10]!.valores).toEqual([10]);
    expect(t.meses.reduce((n, m) => n + m.valores[0]!, 0)).toBe(160);
  });
});
