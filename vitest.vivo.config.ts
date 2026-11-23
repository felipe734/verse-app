import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { include: ["tests/vivo/**/*.vivo.test.ts"], environment: "node", testTimeout: 120_000 },
});
