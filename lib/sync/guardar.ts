import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { registros, tareas, unidades } from "@/db/esquema";
import type { RegistroAirtable } from "@/lib/airtable/cliente";
import type { ClaveTabla } from "@/lib/airtable/definicion";
import { TABLAS } from "@/lib/airtable/mapeo";
import { huella } from "./huella";
import { proyectar } from "./tablas";

const LOTE = 200;

/** Inserta o actualiza filas en la copia y en su proyección (tareas o unidades). */
export async function guardar(db: Db, clave: ClaveTabla, filas: RegistroAirtable[]): Promise<void> {
  const { idBase, idTabla } = TABLAS[clave];
  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    await db
      .insert(registros)
      .values(
        lote.map((r) => ({
          idBase,
          idTabla,
          recId: r.id,
          campos: r.fields,
          huella: huella(r.fields),
          creadoEnAirtable: new Date(r.createdTime),
        })),
      )
      .onConflictDoUpdate({
        target: [registros.idBase, registros.idTabla, registros.recId],
        set: { campos: sql`excluded.campos`, huella: sql`excluded.huella`, actualizado: sql`now()` },
      });

    const proy = lote.map((r) => proyectar(clave, r));
    const t = proy.flatMap((p) => (p.tipo === "tarea" ? [p.fila] : []));
    const u = proy.flatMap((p) => (p.tipo === "unidad" ? [p.fila] : []));
    if (t.length) {
      await db
        .insert(tareas)
        .values(t)
        .onConflictDoUpdate({
          target: tareas.recId,
          set: {
            numero: sql`excluded.numero`,
            tipo: sql`excluded.tipo`,
            asunto: sql`excluded.asunto`,
            proceso: sql`excluded.proceso`,
            estado: sql`excluded.estado`,
            responsable: sql`excluded.responsable`,
            fechaLimite: sql`excluded.fecha_limite`,
            detalle: sql`excluded.detalle`,
            link: sql`excluded.link`,
            linea: sql`excluded.linea`,
            creado: sql`excluded.creado`,
            corrida: sql`excluded.corrida`,
            actualizado: sql`now()`,
          },
        });
    }
    if (u.length) {
      await db
        .insert(unidades)
        .values(u)
        .onConflictDoUpdate({
          target: unidades.recId,
          set: {
            unidad: sql`excluded.unidad`,
            edificio: sql`excluded.edificio`,
            estado: sql`excluded.estado`,
            actualizado: sql`now()`,
          },
        });
    }
  }
}

/** Borra de la copia y de su proyección las filas que Airtable ya no tiene. */
export async function borrar(db: Db, clave: ClaveTabla, recIds: string[]): Promise<void> {
  const { idBase, idTabla } = TABLAS[clave];
  const proyeccion = clave.startsWith("trazabilidad") ? tareas : unidades;
  for (let i = 0; i < recIds.length; i += LOTE) {
    const lote = recIds.slice(i, i + LOTE);
    await db
      .delete(registros)
      .where(and(eq(registros.idBase, idBase), eq(registros.idTabla, idTabla), inArray(registros.recId, lote)));
    await db.delete(proyeccion).where(inArray(proyeccion.recId, lote));
  }
}

/**
 * Rehace tareas y unidades desde la copia fiel (registros), sin llamar a Airtable.
 * Corre en el build, para que un cambio en la proyección aplique a lo ya copiado.
 */
export async function reproyectar(db: Db): Promise<number> {
  let total = 0;
  for (const [clave, t] of Object.entries(TABLAS) as [ClaveTabla, (typeof TABLAS)[ClaveTabla]][]) {
    const filas = await db
      .select()
      .from(registros)
      .where(and(eq(registros.idBase, t.idBase), eq(registros.idTabla, t.idTabla)));
    await guardar(
      db,
      clave,
      filas.map((f) => ({ id: f.recId, createdTime: f.creadoEnAirtable.toISOString(), fields: f.campos })),
    );
    total += filas.length;
  }
  return total;
}
