import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db/cliente";
import { ids } from "@/lib/modulos/tablas-equipo";
import { clienteServidor } from "@/lib/servidor/airtable";
import { composioServidor } from "@/lib/servidor/composio";

/**
 * Salud de la app para el monitor de GitHub: base de datos, Airtable y Composio.
 * Pública pero sin datos: solo si cada pieza responde. 503 si falla la base o Airtable;
 * Composio solo avisa (el correo puede estar apagado sin tumbar la app).
 */
type Estado = "ok" | "falla" | "apagado";
let ultima: { en: number; cuerpo: Record<string, unknown>; codigo: number } | null = null;

async function probar(f: () => Promise<unknown>): Promise<Estado> {
  try {
    await Promise.race([f(), new Promise((_, no) => setTimeout(() => no(new Error("tiempo")), 10_000))]);
    return "ok";
  } catch (e) {
    console.error("[salud]", e instanceof Error ? e.message : e);
    return "falla";
  }
}

export async function GET() {
  await connection();
  if (ultima && Date.now() - ultima.en < 30_000) return Response.json(ultima.cuerpo, { status: ultima.codigo });
  const R = ids("6. OPERACION 360", "RESERVAS");
  const composio = composioServidor();
  const [base, airtable, correo] = await Promise.all([
    probar(() => db().execute(sql`select 1`)),
    probar(() => clienteServidor(undefined, { fresco: true }).consultar(R.idBase, R.idTabla, { campos: ["Unidad"], max: 1 })),
    composio ? probar(() => composio.cuentasGmail()) : Promise.resolve<Estado>("apagado"),
  ]);
  const ok = base === "ok" && airtable === "ok";
  const cuerpo = { ok, base, airtable, composio: correo, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" };
  ultima = { en: Date.now(), cuerpo, codigo: ok ? 200 : 503 };
  return Response.json(cuerpo, { status: ultima.codigo, headers: { "Cache-Control": "no-store" } });
}
