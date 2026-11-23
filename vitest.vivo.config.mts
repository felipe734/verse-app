import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ["tests/vivo/**/*.vivo.test.ts"], environment: "node", testTimeout: 120_000 },
});
