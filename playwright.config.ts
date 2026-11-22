import { defineConfig, devices } from "@playwright/test";

const puerto = 3100;
const urlBase = process.env.PLAYWRIGHT_URL_BASE ?? `http://localhost:${puerto}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: urlBase, trace: "retain-on-failure" },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"] } },
    { name: "computador", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_URL_BASE
    ? undefined
    : {
        command: `pnpm start --port ${puerto}`,
        url: urlBase,
        reuseExistingServer: !process.env.CI,
      },
});
