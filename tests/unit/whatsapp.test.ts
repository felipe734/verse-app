import { describe, expect, it } from "vitest";
import { enlaceWhatsapp } from "@/lib/modulos/whatsapp";

describe("enlaceWhatsapp", () => {
  it("agrega el 57 a un celular colombiano de 10 dígitos", () => {
    expect(enlaceWhatsapp("300 210 7030")).toBe("https://wa.me/573002107030");
  });
  it("respeta un número con indicativo", () => {
    expect(enlaceWhatsapp("+57 (300) 210-7030")).toBe("https://wa.me/573002107030");
    expect(enlaceWhatsapp("+33 6 12 34 56 78")).toBe("https://wa.me/33612345678");
  });
  it("sin número no hay enlace", () => {
    expect(enlaceWhatsapp("")).toBeNull();
    expect(enlaceWhatsapp("sin dato")).toBeNull();
    expect(enlaceWhatsapp("12345")).toBeNull();
  });
});
