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
