import { describe, expect, it } from "vitest";
import { diaAirtable, numeroDia } from "@/lib/airtable/formulas";
import { formulaCruza, formulaDentro } from "@/lib/vistas/periodo";

describe("día de un campo en fórmulas de Airtable", () => {
  it("un campo de solo fecha no se pasa a Bogotá (se correría un día)", () => {
    expect(diaAirtable("Salida", "fecha")).toBe("VALUE(DATETIME_FORMAT({Salida}, 'YYYYMMDD'))");
    expect(diaAirtable("Salida", "fecha")).not.toContain("SET_TIMEZONE");
  });

  it("una fecha con hora se lee en Bogotá", () => {
    expect(diaAirtable("Fecha", "fechaHora")).toBe("VALUE(DATETIME_FORMAT(SET_TIMEZONE({Fecha}, 'America/Bogota'), 'YYYYMMDD'))");
  });

  it("sin tipo (filtros de período) decide por la hora: 00:00:00 UTC es solo fecha", () => {
    const f = formulaDentro("Ingreso", { inicio: "2026-11-01", fin: "2026-12-01" });
    expect(f).toContain("IF(DATETIME_FORMAT({Ingreso}, 'HH:mm:ss') = '00:00:00', DATETIME_FORMAT({Ingreso}, 'YYYYMMDD')");
    expect(f).toContain(">= 20261101");
    expect(f).toContain("< 20261201");
    expect(numeroDia("2026-11-24")).toBe("20261124");
  });
  it("una reserva que sale el primer día del mes no cuenta en ese mes; un contrato que termina ese día sí", () => {
    const p = { inicio: "2026-11-01", fin: "2026-12-01" };
    expect(formulaCruza("Ingreso", "Salida", p, true)).toContain("> 20261101");
    expect(formulaCruza("Fecha_Inicio", "Fecha_Finalización", p)).toContain(">= 20261101");
  });
});
