import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    environment: "node",
    // Cada prueba levanta su propio Postgres en memoria (PGlite); en paralelo puede pasar de 5 s.
    testTimeout: 20_000,
  },
});
