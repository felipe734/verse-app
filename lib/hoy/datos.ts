import { and, inArray } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { tareas } from "@/db/esquema";
import { filtrarSuyo, puede, type Sesion } from "@/lib/acceso/permisos";
import { esMio } from "@/lib/vistas/mio";
import { diasDeAtraso, hoyBogota, seccionDe, SECCIONES, type Seccion, type TareaHoy } from "./clasificar";

/** Empresa de la app ↔ empresa en TRAZABILIDAD, y su módulo Hoy. */
export const HOY_POR_EMPRESA: Record<string, { tabla: "Verse" | "C&C"; modulo: string }> = {
  verse: { tabla: "Verse", modulo: "verse-hoy" },
  cyc: { tabla: "C&C", modulo: "cyc-hoy" },
};

export interface ItemHoy extends TareaHoy {
  empresaApp: string;
  atraso: number;
  puedeEditar: boolean;
}

export interface Hoy {
  hoy: string;
  secciones: { id: Seccion; titulo: string; items: ItemHoy[] }[];
  total: number;
}

const COLUMNAS = {
  recId: tareas.recId,
  empresa: tareas.empresa,
  numero: tareas.numero,
  tipo: tareas.tipo,
  asunto: tareas.asunto,
  proceso: tareas.proceso,
  estado: tareas.estado,
  responsable: tareas.responsable,
  fechaLimite: tareas.fechaLimite,
  detalle: tareas.detalle,
  link: tareas.link,
  linea: tareas.linea,
  corrida: tareas.corrida,
};

/** Pendientes abiertos de las empresas pedidas que la sesión puede ver, con su alcance. */
export async function tareasAbiertas(db: Db, s: Sesion, empresas: string[], hoy = hoyBogota()): Promise<ItemHoy[]> {
  const items: ItemHoy[] = [];
  for (const empresa of empresas) {
    const conf = HOY_POR_EMPRESA[empresa];
    if (!conf || !puede(s, empresa, conf.modulo, "ver")) continue;
    const filas = await db
      .select(COLUMNAS)
      .from(tareas)
      .where(and(inArray(tareas.empresa, [conf.tabla]), inArray(tareas.estado, ["Abierto", "En espera"])));
    const editar = puede(s, empresa, conf.modulo, "editar");
    for (const f of filtrarSuyo(filas as TareaHoy[], s, empresa)) {
      items.push({ ...f, empresaApp: empresa, atraso: diasDeAtraso(f, hoy), puedeEditar: editar });
    }
  }
  return items;
}

/**
 * De quién se muestran los pendientes: "mio" (por defecto, si la persona tiene Nombre en Airtable),
 * "todos" o el nombre de una persona. Hoy es de cada quien: no se ven los de los demás salvo que el
 * Maestro lo pida con el filtro de Responsable.
 */
export type Responsable = "mio" | "todos" | (string & {});

export function deResponsable(s: Sesion, r: Responsable | undefined) {
  const pedido = r || "mio";
  if (pedido === "todos" || (pedido === "mio" && !s.nombreAirtable)) return () => true;
  const nombre = pedido === "mio" ? s.nombreAirtable : pedido;
  return (t: Pick<TareaHoy, "responsable">) => esMio(t.responsable ?? undefined, nombre);
}

/** Hoy agrupado en Crítico, Vencido, Hoy, Esta semana y Más adelante; lo más atrasado primero. */
export async function hoyDe(db: Db, s: Sesion, empresas: string[], ahora = new Date(), responsable?: Responsable): Promise<Hoy & { responsables: string[] }> {
  const hoy = hoyBogota(ahora);
  const todos = await tareasAbiertas(db, s, empresas, hoy);
  const responsables = [...new Set(todos.map((t) => t.responsable).filter((r): r is string => Boolean(r)))].sort();
  const items = todos.filter(deResponsable(s, s.maestro ? responsable : "mio"));
  const secciones = SECCIONES.map((sec) => ({
    ...sec,
    items: items
      .filter((t) => seccionDe(t, hoy) === sec.id)
      .sort((a, b) => (a.fechaLimite ?? hoy).localeCompare(b.fechaLimite ?? hoy) || (a.numero ?? 0) - (b.numero ?? 0)),
  }));
  return { hoy, secciones, total: secciones.filter((x) => x.id !== "luego").reduce((n, sec) => n + sec.items.length, 0), responsables: s.maestro ? responsables : [] };
}
