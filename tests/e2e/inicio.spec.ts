import { expect, test } from "@playwright/test";

test("la página de inicio carga con la marca Verse", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Verse App");
  await expect(page.getByRole("heading", { name: "Cimientos" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});

test("el texto visible no usa signos de admiración", async ({ page }) => {
  await page.goto("/");
  const texto = await page.locator("body").innerText();
  expect(texto).not.toMatch(/[!¡]/);
});
