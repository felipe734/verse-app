import { describe, expect, it } from "vitest";
import { documento, enLetras, fechaLarga, pesos, sumarMeses } from "@/lib/contratos/letras";

describe("letras de contratos", () => {
  it("números en letras", () => {
    expect(enLetras(2_500_000)).toBe("dos millones quinientos mil");
    expect(enLetras(1_300_000)).toBe("un millón trescientos mil");
    expect(enLetras(185_000)).toBe("ciento ochenta y cinco mil");
    expect(enLetras(1_750_905)).toBe("un millón setecientos cincuenta mil novecientos cinco");
    expect(enLetras(21_000)).toBe("veintiún mil");
    expect(enLetras(100)).toBe("cien");
    expect(enLetras(12)).toBe("doce");
    expect(enLetras(90)).toBe("noventa");
    expect(enLetras(31_000_000)).toBe("treinta y un millones");
  });

  it("pesos, documento y fechas", () => {
    expect(pesos(2_500_000)).toBe("$2.500.000");
    expect(documento("1020832461")).toBe("1.020.832.461");
    expect(documento("AB123456")).toBe("AB123456");
    expect(fechaLarga("2026-11-27")).toBe("27 de noviembre de 2026");
    expect(sumarMeses("2026-11-27", 12)).toBe("2027-11-27");
    expect(sumarMeses("2027-01-31", 1)).toBe("2027-02-28");
    expect(sumarMeses("2026-09-14", 5)).toBe("2027-02-14");
  });
});
