import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { auditoria } from "@/db/esquema";
import { ESCRITURA, TABLAS } from "@/lib/airtable/mapeo";

/**
 * Actividad de un registro: lo que la app escribió en él (AUDITORIA), con quién, cuándo y qué
 * cambió, en nombres de campo legibles. Solo lo que pasó por la app; lo que se cambió a mano
 * en Airtable o lo hizo una skill no aparece aquí.
 */
type Mapeada = { idTabla: string; campos: Record<string, { id: string; nombre: string }> };
const MAPEADAS = [...Object.values(TABLAS), ...Object.values(ESCRITURA ?? {})] as unknown as Mapeada[];

const nombreCampo = (idTabla: string, id: string) => {
  for (const t of MAPEADAS.filter((x) => x.idTabla === idTabla)) for (const c of Object.values(t.campos)) if (c.id === id) return c.nombre;
  return null;
};

const texto = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "vacío";
  if (typeof v === "boolean") return v ? "sí" : "no";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x && "filename" in x ? String((x as { filename: unknown }).filename) : texto(x))).join(", ");
  if (typeof v === "object") return "";
  const s = String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

export interface Evento {
  cuando: string;
  autor: string;
  resumen: string;
}

export async function actividadDe(db: Db, idTabla: string, recId: string): Promise<Evento[]> {
  const filas = await db
    .select()
    .from(auditoria)
    .where(and(eq(auditoria.idTabla, idTabla), eq(auditoria.recId, recId)))
    .orderBy(desc(auditoria.cuando))
    .limit(15);
  return filas.map((f) => {
    const cambios = Object.entries(f.despues ?? {})
      .map(([id, v]) => {
        const n = nombreCampo(idTabla, id);
        return n ? `${n}: ${texto(v)}` : null;
      })
      .filter(Boolean)
      .slice(0, 4);
    const que =
      f.accion === "escritura.crear" ? "Creó el registro" : f.accion === "escritura.actualizar" ? "Cambió" : f.accion === "escritura.rechazada" ? "Intentó cambiar (Airtable no aceptó)" : f.detalle || f.accion;
    return {
      cuando: (f.cuando instanceof Date ? f.cuando : new Date(f.cuando)).toISOString(),
      autor: f.autor.split("@")[0] ?? f.autor,
      resumen: cambios.length ? `${que} · ${cambios.join(" · ")}` : que,
    };
  });
}
