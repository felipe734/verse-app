import { sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { empresas, modulos, plantillas, usuarios, verticales } from "@/db/esquema";
import { ESTRUCTURA } from "./estructura";
import { PLANTILLAS } from "./plantillas";

/**
 * Siembra la estructura y las plantillas de arranque. Solo inserta lo que falta:
 * lo que Felipe cambie en Ajustes no se pisa.
 * El Maestro sale de MAESTRO_CORREO (en Vercel), nunca del repo.
 */
export async function sembrar(db: Db, maestro?: { correo: string; nombre: string }): Promise<void> {
  for (const [i, e] of ESTRUCTURA.entries()) {
    await db.insert(empresas).values({ id: e.id, nombre: e.nombre, orden: i, cuentas: e.cuentas }).onConflictDoNothing();
    for (const [j, v] of e.verticales.entries()) {
      await db.insert(verticales).values({ id: v.id, empresaId: e.id, nombre: v.nombre, orden: j }).onConflictDoNothing();
      for (const [k, m] of v.modulos.entries()) {
        await db.insert(modulos).values({ id: m.id, verticalId: v.id, nombre: m.nombre, descripcion: m.descripcion, orden: k }).onConflictDoNothing();
      }
    }
  }
  for (const p of PLANTILLAS) {
    await db.insert(plantillas).values({ id: p.id, empresaId: p.empresa, nombre: p.nombre, casillas: p.casillas }).onConflictDoNothing();
  }
  if (maestro) {
    const correo = maestro.correo.trim().toLowerCase();
    await db
      .insert(usuarios)
      .values({ correo, nombre: maestro.nombre, estado: "activo", maestro: true, nombreAirtable: "Felipe" })
      .onConflictDoUpdate({ target: usuarios.correo, set: { maestro: true, estado: sql`case when ${usuarios.estado} = 'suspendido' then 'suspendido' else 'activo' end` } });
  }
}
