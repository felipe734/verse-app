/** Aplica las migraciones de db/migraciones en Neon. Corre en el build de Vercel. */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.log("Sin DATABASE_URL: no se migra.");
    return;
  }
  await migrate(drizzle(neon(url)), { migrationsFolder: "db/migraciones" });
  console.log("Migraciones aplicadas.");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Falló la migración");
  process.exit(1);
});
