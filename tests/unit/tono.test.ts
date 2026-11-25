import { describe, expect, it } from "vitest";
import { tonoDe } from "@/lib/vistas/tono";

describe("tono de estados", () => {
  it("hecho en verde, en curso en azul, pendiente en ámbar, problema en rojo", () => {
    expect(tonoDe("PAGO")).toBe("ok");
    expect(tonoDe("Terminado")).toBe("ok");
    expect(tonoDe("Firmado")).toBe("ok");
    expect(tonoDe("Renovado")).toBe("ok");
    expect(tonoDe("Programado")).toBe("curso");
    expect(tonoDe("Elaborado")).toBe("curso");
    expect(tonoDe("Contactado")).toBe("curso");
    expect(tonoDe("POR PAGAR")).toBe("pendiente");
    expect(tonoDe("Nuevo")).toBe("pendiente");
    expect(tonoDe("Abierto")).toBe("pendiente");
    expect(tonoDe("Vencido")).toBe("problema");
    expect(tonoDe("Perdido")).toBe("problema");
    expect(tonoDe("Terminación")).toBe("problema");
    expect(tonoDe("Rechazado")).toBe("problema");
    expect(tonoDe("")).toBe("neutro");
    expect(tonoDe("Otros")).toBe("neutro");
  });
});
