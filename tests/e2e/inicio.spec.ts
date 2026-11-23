import { expect, test } from "@playwright/test";

test("la página de inicio carga con la marca Verse", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Verse App");
  await expect(page.getByRole("heading", { name: "Verse App", level: 1 })).toBeVisible();
  await expect(page.getByText("Verse App es la aplicación interna")).toBeVisible();
  // Enlace en el texto y en el pie, como pide Google.
  const enlaces = page.getByRole("link", { name: "política de privacidad" });
  await expect(enlaces).toHaveCount(2);
  for (const enlace of await enlaces.all()) await expect(enlace).toHaveAttribute("href", "/privacidad");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("el texto visible no usa signos de admiración", async ({ page }) => {
  await page.goto("/");
  const texto = await page.locator("body").innerText();
  expect(texto).not.toMatch(/[!¡]/);
});

test("la política de privacidad es pública y no usa signos de admiración", async ({ page }) => {
  await page.goto("/privacidad");
  await expect(page.getByRole("heading", { name: "Política de privacidad" })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/[!¡]/);
});

test("la página de entrar ofrece Google y explica los errores", async ({ page }) => {
  await page.goto("/entrar?error=sin-invitacion");
  await expect(page.getByRole("button", { name: "Entrar con Google" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "no tiene invitación" })).toBeVisible();
});

test("sin sesión, Hoy manda a entrar y no muestra módulos", async ({ page }) => {
  await page.goto("/hoy");
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByText("Módulos")).toHaveCount(0);
});

test("sin sesión, Ajustes manda a entrar", async ({ page }) => {
  await page.goto("/ajustes");
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByText("Nuevo usuario")).toHaveCount(0);
});

test("sin sesión, Correo manda a entrar y no lee bandejas", async ({ page }) => {
  await page.goto("/correo");
  await expect(page).toHaveURL(/\/entrar/);
  await page.goto("/correo/verse-felipe/1a2063103bb432fa");
  await expect(page).toHaveURL(/\/entrar/);
});

test("la app es instalable: manifiesto e ícono", async ({ request }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.ok()).toBe(true);
  expect(await m.json()).toMatchObject({ name: "Verse App", start_url: "/hoy", display: "standalone" });
  const icono = await request.get("/icono/192");
  expect(icono.headers()["content-type"]).toContain("image/png");
  expect((await request.get("/icono/77")).status()).toBe(404);
});
