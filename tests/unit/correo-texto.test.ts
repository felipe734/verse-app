import { describe, expect, it } from "vitest";
import { paraResponder, reglaSimple } from "@/lib/correo/atencion";
import { htmlATexto, textoLegible } from "@/lib/correo/texto";

describe("correo legible", () => {
  it("convierte el HTML del remitente en párrafos, viñetas y enlaces", () => {
    const html = `<html><head><style>p{color:red}</style></head><body><p>Hola Felipe,</p><p>Adjunto el estado&nbsp;de cuenta.<br>Saldo: $1.200.000</p><ul><li>Uno</li><li>Dos</li></ul><a href="https://banco.co/x">Ver detalle</a><img src="https://rastreo/p.gif"></body></html>`;
    const t = htmlATexto(html);
    expect(t).toContain("Hola Felipe,");
    expect(t).toContain("Adjunto el estado de cuenta.\\nSaldo: $1.200.000".replace("\\n", "\n"));
    expect(t).toContain("• Uno");
    expect(t).toContain("Ver detalle (https://banco.co/x)");
    expect(t).not.toMatch(/<|color:red/);
  });
  it("el texto plano se deja tal cual", () => {
    expect(textoLegible("Hola\n\n\n\nChao")).toBe("Hola\n\nChao");
  });
});

describe("para responder", () => {
  const c = (de: string, responde = true) => ({ id: de, de, asunto: "x", vista: "y", responde });
  it("sin IA: se responde y no es automático", () => {
    expect(reglaSimple(c("Propietario <persona@gmail.com>"))).toBe(true);
    expect(reglaSimple(c("Airbnb <automated@airbnb.com>"))).toBe(false);
    expect(reglaSimple(c("Facturación <facturacion@proveedor.co>"))).toBe(false);
    expect(reglaSimple(c("Alguien <a@b.co>", false))).toBe(false);
  });
  it("si el clasificador falla, usa la regla", async () => {
    const r = await paraResponder([c("Ana <ana@gmail.com>"), c("no-reply@x.co")], async () => {
      throw new Error("caído");
    });
    expect([...r]).toEqual(["Ana <ana@gmail.com>"]);
  });
});
