/**
 * Aplica las migraciones de db/migraciones en Neon y siembra la estructura de arranque.
 * Corre en el build de Vercel.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import type { Db } from "../db/cliente";
import * as esquema from "../db/esquema";
import { sembrar } from "../lib/acceso/sembrar";
import { reproyectar } from "../lib/sync/guardar";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.log("Sin DATABASE_URL: no se migra.");
    return;
  }
  const db = drizzle(neon(url), { schema: esquema });
  await migrate(db, { migrationsFolder: "db/migraciones" });
  console.log("Migraciones aplicadas.");

  const correo = process.env.MAESTRO_CORREO;
  await sembrar(db as unknown as Db, correo ? { correo, nombre: process.env.MAESTRO_NOMBRE ?? "Felipe" } : undefined);
  console.log(correo ? "Estructura y Maestro sembrados." : "Estructura sembrada. Falta MAESTRO_CORREO para el Maestro.");

  const filas = await reproyectar(db as unknown as Db);
  console.log(`Proyecciones rehechas desde la copia: ${filas} filas.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Falló la migración");
  process.exit(1);
});
