import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";

/**
 * Capturas para el PR: celular (390 px) y computador (1440 px), claro y oscuro.
 * Solo con CAPTURAS=nombre-del-pr; quedan en docs/capturas/<nombre>/.
 */
const carpeta = process.env.CAPTURAS;
const PANTALLAS: { nombre: string; ruta: string; accion?: "comandos" | "detalle" | "editar" | "crear" | "asistente"; usuario?: string }[] = (process.env.CAPTURAS_RUTAS ?? "hoy:/verse/general/hoy")
  .split(",")
  .map((x) => {
    // nombre:ruta[:accion][:usuario de la vitrina]
    const [nombre, ruta, accion, usuario] = x.split(":");
    return { nombre: nombre!, ruta: ruta!, accion: (accion || undefined) as never, usuario: usuario || undefined };
  });

test.describe("capturas", () => {
  test.skip(!carpeta, "Solo cuando se piden capturas");
  test.skip(({ isMobile }) => isMobile, "Los tamaños se fijan abajo");

  for (const p of PANTALLAS)
    for (const [disp, ancho, alto] of [
      ["celular", 390, 844],
      ["computador", 1440, 900],
    ] as const)
      for (const tema of ["light", "dark"] as const)
        test(`${p.nombre} ${disp} ${tema}`, async ({ page, baseURL }) => {
          mkdirSync(`docs/capturas/${carpeta}`, { recursive: true });
          await page.context().addCookies([{ name: "vitrina_usuario", value: p.usuario ?? "maestro", url: baseURL! }]);
          await page.setViewportSize({ width: ancho, height: alto });
          await page.emulateMedia({ colorScheme: tema });
          await page.goto(p.ruta);
          await page.waitForLoadState("networkidle");
          if (p.accion === "comandos") {
            await page.keyboard.press("ControlOrMeta+k");
            await page.getByPlaceholder(/Busca un módulo/).fill("pol");
            await page.waitForTimeout(700);
          } else if (p.accion === "detalle") {
            const filaTabla = page.locator("tbody tr").first();
            if (await filaTabla.count()) await filaTabla.click();
            else await page.locator("main li button").nth(1).click();
          } else if (p.accion === "editar") {
            await page.locator("tbody tr").first().click();
            await page.getByRole("dialog").getByRole("button", { name: "Editar" }).click();
            await page.getByRole("form", { name: "Editar fila" }).waitFor();
          } else if (p.accion === "crear") {
            await page.getByRole("button", { name: /^Nuevo/ }).click();
            await page.getByRole("form").first().waitFor();
          } else if (p.accion === "asistente") {
            await page.keyboard.press("ControlOrMeta+j");
          }
          await page.waitForTimeout(400);
          await page.screenshot({ path: `docs/capturas/${carpeta}/${p.nombre}-${disp}-${tema === "light" ? "claro" : "oscuro"}.png` });
        });
});
