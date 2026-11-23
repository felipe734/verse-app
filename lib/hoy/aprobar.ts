import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { tareas } from "@/db/esquema";
import { puede, puedeAprobar, type Sesion } from "@/lib/acceso/permisos";
import { yaAprobada } from "./acciones";
import { esAprobar, type TareaHoy } from "./clasificar";
import { HOY_POR_EMPRESA } from "./datos";

/** Módulo donde vive Para aprobar en cada empresa (en C&C va junto con Hoy). */
const MODULO_APROBAR: Record<string, string> = { verse: "verse-aprobar", cyc: "cyc-hoy" };

export interface Aprobacion extends TareaHoy {
  empresaApp: string;
  /** Texto del cambio, sin la etiqueta "Aprobar: ". */
  cambio: string;
  puedeResponder: boolean;
  aprobadaEnApp: boolean;
}

/** Quién ve Para aprobar: el módulo en ver, o la casilla Aprobar. */
export function veAprobar(s: Sesion, empresa: string): boolean {
  const m = MODULO_APROBAR[empresa];
  return Boolean(m) && (puedeAprobar(s, empresa) || puede(s, empresa, m!, "ver"));
}

/**
 * Filas "Aprobar: " abiertas de las empresas pedidas. Las ya aprobadas en la app se muestran
 * aparte hasta que Verse OS las aplique y las cierre.
 */
export async function aprobacionesDe(db: Db, s: Sesion, empresas: string[]): Promise<Aprobacion[]> {
  const lista: Aprobacion[] = [];
  for (const empresa of empresas) {
    const conf = HOY_POR_EMPRESA[empresa];
    if (!conf || !veAprobar(s, empresa)) continue;
    const filas = await db
      .select()
      .from(tareas)
      .where(and(eq(tareas.empresa, conf.tabla), inArray(tareas.estado, ["Abierto"])));
    const responder = puedeAprobar(s, empresa);
    for (const f of filas as unknown as TareaHoy[]) {
      if (!esAprobar(f)) continue;
      const aprobada = yaAprobada(f.detalle);
      const primera = (f.detalle ?? "").split("\n")[0]!.replace(/^\s*Aprobar:\s*/, "");
      lista.push({ ...f, empresaApp: empresa, cambio: primera, puedeResponder: responder && !aprobada, aprobadaEnApp: aprobada });
    }
  }
  return lista.sort((a, b) => Number(a.aprobadaEnApp) - Number(b.aprobadaEnApp) || (a.numero ?? 0) - (b.numero ?? 0));
}
