import { describe, expect, it } from "vitest";
import { clienteComposio } from "@/lib/correo/composio";
import { conectarCuenta, estadoConexiones } from "@/lib/correo/conexiones";
import { ComposioFalso } from "../apoyo/composio-falso";

const VOLVER = "https://app.prueba.test/ajustes?vista=conexiones";

describe("conexiones de Composio", () => {
  it("reconoce cada cuenta por alias o por su nombre gmail_ de antes, sin la personal", async () => {
    const c = new ComposioFalso();
    const e = await estadoConexiones(c);
    expect(e.map((x) => [x.alias, x.estado])).toEqual([
      ["verse-felipe", "activa"],
      ["verse-contabilidad", "activa"],
      ["verse-contacto", "activa"],
      ["cyc-comercial", "activa"],
      ["cyc-contabilidad", "falta"],
      ["verse-drive", "activa"],
    ]);
  });

  it("una cuenta que falta pide el enlace de Google con su alias", async () => {
    const c = new ComposioFalso();
    const url = await conectarCuenta(c, "cyc-contabilidad", VOLVER);
    expect(url).toContain("accounts.google.com");
    expect(c.conexiones).toEqual([{ toolkit: "gmail", alias: "cyc-contabilidad", volver: VOLVER }]);
  });

  it("una activa no se toca y una vencida se borra antes de volver a conectar", async () => {
    const c = new ComposioFalso();
    expect(await conectarCuenta(c, "verse-felipe", VOLVER)).toBeNull();
    c.drive = [{ id: "ca_drive_vieja", alias: "verse-drive", wordId: null, estado: "EXPIRED" }];
    await conectarCuenta(c, "verse-drive", VOLVER);
    expect(c.quitadas).toEqual(["ca_drive_vieja"]);
    expect(c.conexiones.map((x) => x.toolkit)).toEqual(["googledrive"]);
  });

  it("no conecta cuentas que no son de la app", async () => {
    await expect(conectarCuenta(new ComposioFalso(), "felipe-personal", VOLVER)).rejects.toThrow("no es de la app");
  });

  it("usa la configuración de Composio existente y manda alias y regreso al enlace", async () => {
    const pedidas: { url: string; cuerpo?: unknown }[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      pedidas.push({ url, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes("/auth_configs?")) return Response.json({ items: [{ id: "ac_gmail", status: "ENABLED" }] });
      if (url.endsWith("/connected_accounts/link")) return Response.json({ redirect_url: "https://accounts.google.com/x", connected_account_id: "ca_1" }, { status: 201 });
      return new Response(null, { status: 404 });
    }) as typeof fetch;
    const url = await clienteComposio("ak_prueba", fetcher).conectar("gmail", "cyc-contabilidad", VOLVER);
    expect(url).toBe("https://accounts.google.com/x");
    expect(pedidas[1]!.cuerpo).toEqual({ auth_config_id: "ac_gmail", user_id: "verse-app", alias: "cyc-contabilidad", callback_url: VOLVER });
  });

  it("crea la configuración de Composio si el proyecto no tiene una", async () => {
    const pedidas: { url: string; metodo?: string; cuerpo?: unknown }[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      pedidas.push({ url, metodo: init?.method, cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes("/auth_configs?")) return Response.json({ items: [] });
      if (url.endsWith("/auth_configs")) return Response.json({ auth_config: { id: "ac_nueva" } }, { status: 201 });
      return Response.json({ redirect_url: "https://accounts.google.com/y" }, { status: 201 });
    }) as typeof fetch;
    await clienteComposio("ak_prueba", fetcher).conectar("googledrive", "verse-drive", VOLVER);
    expect(pedidas[1]).toMatchObject({ metodo: "POST", cuerpo: { toolkit: { slug: "googledrive" }, auth_config: { type: "use_composio_managed_auth" } } });
    expect(pedidas[2]!.cuerpo).toMatchObject({ auth_config_id: "ac_nueva" });
  });
});
