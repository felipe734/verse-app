import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // PGlite solo se usa en la vitrina de Playwright; se carga tal cual, sin empaquetar.
  // react-pdf arma los contratos en el servidor; sus fuentes (lib/contratos/fuentes) se leen del disco.
  serverExternalPackages: ["@electric-sql/pglite", "@react-pdf/renderer"],
  outputFileTracingIncludes: { "/**": ["./lib/contratos/fuentes/**"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
