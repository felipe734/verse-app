import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras, costosNeon, llamadasAirtable, mensajesAsistente, reconciliaciones, respaldos, syncEstado, tareas } from "@/db/esquema";
import { puede, type Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { HOY_POR_EMPRESA } from "@/lib/hoy/datos";

/** Módulo Sistema de cada empresa. */
export const SISTEMA_POR_EMPRESA: Record<string, string> = { verse: "verse-sistema", cyc: "cyc-sistema" };

const NOMBRES: Record<string, string> = {
  trazabilidadVerse: "TRAZABILIDAD VERSE",
  trazabilidadCyC: "TRAZABILIDAD C&C",
  unidadesHost: "UNIDADES Host",
  unidadesLiving: "UNIDADES Living",
};

export interface Sistema {
  empresa: string;
  corridas: { recId: string; asunto: string | null; proceso: string | null; estado: string | null; creado: Date | null; detalle: string | null }[];
  fallas: { tipo: string; texto: string; cuando: Date | null }[];
  /** Solo en Verse: lo de la app (sincronización, respaldo, llamadas y Neon). */
  app: null | {
    tablas: {
      clave: string;
      nombre: string;
      filas: number;
      ultimaReconciliacion: Date | null;
      webhookVence: Date | null;
      error: string | null;
      noches: boolean[];
    }[];
    nochesSeguidas: number;
    respaldos: (typeof respaldos.$inferSelect)[];
    llamadas: { dia: string; workspace: string; llamadas: number }[];
    neon: typeof costosNeon.$inferSelect | null;
    colaFallidas: number;
    /** Asistente en 7 días: respuestas del modelo, preguntas de personas y costo. */
    asistente: { respuestas: number; preguntas: number; costoUsd: number; porPregunta: number };
  };
}

function haceDias(dias: number, ahora = new Date()): Date {
  return new Date(ahora.getTime() - dias * 24 * 3600_000);
}

/** Noches seguidas (hasta anoche) en que las cuatro tablas cuadraron: el "listo cuando" de la entrega 0. */
export function contarNoches(porDia: Map<string, boolean>, hoy: string): number {
  let n = 0;
  const d = new Date(`${hoy}T12:00:00Z`);
  // Si hoy ya corrió, cuenta desde hoy; si no, desde ayer.
  if (!porDia.has(hoy)) d.setUTCDate(d.getUTCDate() - 1);
  for (;;) {
    const dia = d.toISOString().slice(0, 10);
    if (porDia.get(dia) !== true) return n;
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
}

export async function sistemaDe(db: Db, s: Sesion, empresa: string, ahora = new Date()): Promise<Sistema | null> {
  const modulo = SISTEMA_POR_EMPRESA[empresa];
  const conf = HOY_POR_EMPRESA[empresa];
  if (!modulo || !conf || !puede(s, empresa, modulo, "ver")) return null;
  const desde = haceDias(7, ahora);

  const corridas = await db
    .select({ recId: tareas.recId, asunto: tareas.asunto, proceso: tareas.proceso, estado: tareas.estado, creado: tareas.creado, detalle: tareas.detalle })
    .from(tareas)
    .where(and(eq(tareas.empresa, conf.tabla), eq(tareas.tipo, "Corrida"), gte(tareas.creado, desde)))
    .orderBy(desc(tareas.creado))
    .limit(60);

  const fallas: Sistema["fallas"] = corridas
    .filter((c) => c.estado === "Falló" || c.estado === "Frenado")
    .map((c) => ({ tipo: `Corrida ${c.estado?.toLowerCase()}`, texto: `${c.proceso ?? ""} · ${c.asunto ?? ""}`, cuando: c.creado }));

  if (empresa !== "verse") return { empresa, corridas, fallas, app: null };

  const estados = await db.select().from(syncEstado);
  const recs = await db.select().from(reconciliaciones).where(gte(reconciliaciones.cuando, haceDias(10, ahora))).orderBy(desc(reconciliaciones.cuando));
  const hoy = hoyBogota(ahora);
  const diaDe = (f: Date) => hoyBogota(f);

  // Por día: cuadra si la última reconciliación de cada tabla ese día cuadró.
  const ultimaPorDiaYTabla = new Map<string, boolean>();
  for (const r of recs) {
    const k = `${diaDe(r.cuando)}|${r.clave}`;
    if (!ultimaPorDiaYTabla.has(k)) ultimaPorDiaYTabla.set(k, r.cuadra);
  }
  const claves = Object.keys(NOMBRES);
  const porDia = new Map<string, boolean>();
  for (const k of ultimaPorDiaYTabla.keys()) {
    const dia = k.split("|")[0]!;
    if (porDia.has(dia)) continue;
    porDia.set(dia, claves.every((c) => ultimaPorDiaYTabla.get(`${dia}|${c}`) === true));
  }

  const ultimos3: string[] = [];
  for (let i = 2; i >= 0; i--) ultimos3.push(diaDe(haceDias(i, ahora)));

  for (const e of estados) {
    if (e.error) fallas.push({ tipo: "Sincronización", texto: `${NOMBRES[e.clave] ?? e.clave}: ${e.error}`, cuando: e.ultimaReconciliacion });
  }
  const respaldosRecientes = await db.select().from(respaldos).orderBy(desc(respaldos.fecha)).limit(7);
  for (const r of respaldosRecientes) {
    if (r.estado === "con_fallas") fallas.push({ tipo: "Respaldo", texto: `${r.fecha}: ${r.fallidas} tablas fallaron`, cuando: r.fin });
    if (r.estado === "en_curso" && r.fecha < hoy) fallas.push({ tipo: "Respaldo", texto: `${r.fecha}: no terminó`, cuando: r.inicio });
  }
  const [{ colaFallidas } = { colaFallidas: 0 }] = await db
    .select({ colaFallidas: sql<number>`count(*)::int` })
    .from(colaEscrituras)
    .where(and(inArray(colaEscrituras.estado, ["fallida"]), gte(colaEscrituras.creado, desde)));

  const llamadas = await db
    .select({ dia: llamadasAirtable.dia, workspace: llamadasAirtable.workspace, llamadas: sql<number>`sum(${llamadasAirtable.llamadas})::int` })
    .from(llamadasAirtable)
    .where(gte(llamadasAirtable.dia, diaDe(haceDias(7, ahora))))
    .groupBy(llamadasAirtable.dia, llamadasAirtable.workspace)
    .orderBy(desc(llamadasAirtable.dia));
  const [neon] = await db.select().from(costosNeon).orderBy(desc(costosNeon.dia)).limit(1);
  const [uso = { respuestas: 0, preguntas: 0, costo: 0 }] = await db
    .select({
      respuestas: sql<number>`count(*) filter (where ${mensajesAsistente.rol} = 'assistant')::int`,
      preguntas: sql<number>`count(*) filter (where ${mensajesAsistente.rol} = 'user' and ${mensajesAsistente.contenido}::text not like '%tool_result%')::int`,
      costo: sql<number>`coalesce(sum(${mensajesAsistente.costoUsd}), 0)::float`,
    })
    .from(mensajesAsistente)
    .where(gte(mensajesAsistente.creado, desde));

  return {
    empresa,
    corridas,
    fallas,
    app: {
      tablas: claves.map((clave) => {
        const e = estados.find((x) => x.clave === clave);
        return {
          clave,
          nombre: NOMBRES[clave]!,
          filas: e?.filas ?? 0,
          ultimaReconciliacion: e?.ultimaReconciliacion ?? null,
          webhookVence: e?.webhookVence ?? null,
          error: e?.error ?? null,
          noches: ultimos3.map((dia) => ultimaPorDiaYTabla.get(`${dia}|${clave}`) === true),
        };
      }),
      nochesSeguidas: contarNoches(porDia, hoy),
      respaldos: respaldosRecientes,
      llamadas,
      neon: neon ?? null,
      colaFallidas,
      asistente: {
        respuestas: uso.respuestas,
        preguntas: uso.preguntas,
        costoUsd: Math.round(uso.costo * 10000) / 10000,
        porPregunta: uso.preguntas ? Math.round((uso.costo / uso.preguntas) * 10000) / 10000 : 0,
      },
    },
  };
}
