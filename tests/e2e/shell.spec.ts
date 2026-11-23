import { expect, test } from "@playwright/test";


test.beforeEach(async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "maestro", url: baseURL! }]);
});

test("Hoy carga en /verse/general/hoy con la barra por vertical", async ({ page, isMobile }) => {
  await page.goto("/hoy");
  await expect(page).toHaveURL(/\/verse\/general\/hoy$/);
  await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Crítico/ })).toBeVisible();
  if (!isMobile) {
    const barra = page.locator("[data-sidebar=sidebar]");
    await expect(barra.getByText("General")).toBeVisible();
    await expect(barra.getByRole("link", { name: "Para aprobar" })).toBeVisible();
    await expect(barra.getByRole("link", { name: "Ajustes" })).toBeVisible();
  }
});

test("el detalle se abre en panel lateral", async ({ page }) => {
  await page.goto("/verse/general/hoy");
  await page.getByRole("button", { name: /Póliza de la unidad 603 Pagar/ }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Fila en Airtable")).toBeVisible();
  await expect(panel).toHaveAttribute("data-seleccion", /fila \d+ de Verse/);
});

test("⌘K busca pendientes y lleva a la fila", async ({ page, isMobile }) => {
  test.skip(isMobile, "El atajo de teclado es de computador");
  await page.goto("/verse/general/hoy");
  await page.getByRole("button", { name: /Buscar/ }).click();
  await page.keyboard.press("Escape");
  // Con la página hidratada, el atajo abre la paleta.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder(/Busca un módulo/).fill("lencer");
  await page.getByRole("option", { name: /Lencería para dos unidades/ }).click();
  await expect(page).toHaveURL(/fila=rec/);
  await expect(page.getByRole("dialog").getByText("Lencería para dos unidades")).toBeVisible();
});

test("Todas junta Verse y C&C en Hoy", async ({ page }) => {
  await page.goto("/todas/general/hoy");
  await expect(page.getByText("Acta de corte 7")).toBeVisible();
  await expect(page.getByText("Póliza de la unidad 603")).toBeVisible();
});

test("coordinación de aseo no ve Correo, Ajustes ni Para aprobar de Verse", async ({ page, baseURL, isMobile }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "aseo@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/general/hoy");
  await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
  // Lo suyo: solo Alejandra.
  await expect(page.getByText("Programación de limpiezas")).toBeVisible();
  await expect(page.getByText("Póliza de la unidad 603")).toHaveCount(0);
  if (!isMobile) {
    const barra = page.locator("[data-sidebar=sidebar]");
    await expect(barra.getByRole("link", { name: "Correo" })).toHaveCount(0);
    await expect(barra.getByRole("link", { name: "Ajustes" })).toHaveCount(0);
  }
  await page.goto("/verse/general/aprobar");
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
});

test("un módulo sin construir no se abre y una empresa ajena lleva al inicio", async ({ page }) => {
  await page.goto("/verse/host/operacion");
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
  await page.goto("/otra/general/hoy");
  await expect(page).toHaveURL(/\/verse\/general\/hoy$/);
});

test("Correo abre el hilo en panel lateral, en texto", async ({ page }) => {
  await page.goto("/verse/general/correo");
  await expect(page.getByRole("heading", { name: "Correo", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /Estado de cuenta de noviembre/ }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText(/Adjuntamos el estado de cuenta/)).toBeVisible();
  await expect(panel).toHaveAttribute("data-seleccion", /hilo 1a2000000000a01 de la cuenta verse-felipe/);
});

test("el administrador de Verse solo lee contabilidad@ y contacto@", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "admin@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/general/correo");
  await expect(page.getByText("Quiero poner mi apartamento en arriendo")).toBeVisible();
  await expect(page.getByText("Estado de cuenta de noviembre")).toHaveCount(0);
});

test("Sistema muestra indicadores y corridas", async ({ page }) => {
  await page.goto("/sistema");
  await expect(page).toHaveURL(/\/verse\/general\/sistema$/);
  await expect(page.getByText("Fallas en 7 días")).toBeVisible();
});
