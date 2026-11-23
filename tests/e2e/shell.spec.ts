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
  await page.goto("/verse/host/ruta");
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

test("Ajustes: usuarios, empresas con acento y módulos no disponibles", async ({ page, isMobile }) => {
  await page.goto("/ajustes");
  await expect(page.getByRole("heading", { name: "Ajustes", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana Prueba" })).toBeVisible();
  await page.getByRole("link", { name: "Empresas y módulos" }).click();
  await expect(page.getByText("No disponible").first()).toBeVisible();
  if (!isMobile) await expect(page.getByLabel("Elegir color").first()).toBeVisible();
});

test("Ajustes es solo para el Maestro", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "admin@vitrina.test", url: baseURL! }]);
  await page.goto("/ajustes");
  await expect(page.getByText("Ajustes es solo para el Maestro.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana Prueba" })).toHaveCount(0);
});

test("un módulo de tabla oculta montos y terceros según la plantilla", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "aseo@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/host/operacion");
  await expect(page.getByRole("heading", { name: "Operación", level: 1 })).toBeVisible();
  await expect(page.getByText(/Tu acceso no incluye montos, datos de terceros/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Total" })).toHaveCount(0);
});

test("el Maestro abre el detalle de una fila de tabla", async ({ page }) => {
  await page.goto("/cyc/obra/actas");
  await expect(page.getByRole("heading", { name: "Actas", level: 1 })).toBeVisible();
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog").getByText("A pagar", { exact: true })).toBeVisible();
});

test("Finanzas de Verse muestra el cierre y cambia de pestaña", async ({ page }) => {
  await page.goto("/verse/general/finanzas");
  await expect(page.getByRole("heading", { name: "Finanzas", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cierre del mes" }).getByText("Margen neto")).toBeVisible();
  await expect(page.getByRole("link", { name: "Movimientos" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Cruces" }).click();
  await expect(page).toHaveURL(/pestana=cruces/);
  await expect(page.getByRole("link", { name: "Cruces" })).toHaveAttribute("aria-current", "page");
});

test("Finanzas C&C no muestra números de cuenta", async ({ page, isMobile }) => {
  await page.goto("/cyc/general/finanzas?pestana=referencias");
  await expect(page.getByRole("link", { name: "Referencias bancarias" })).toHaveAttribute("aria-current", "page");
  if (!isMobile) await expect(page.getByRole("button", { name: "Tipo de cuenta" })).toBeVisible();
  await expect(page.getByText("# CUENTA")).toHaveCount(0);
});
