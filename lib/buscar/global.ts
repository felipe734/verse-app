import { and, ilike, inArray, or } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { tareas, unidades } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { filtrarSuyo, puede, type Sesion } from "@/lib/acceso/permisos";
import { buscarReservas } from "@/lib/asistente/vivo";
import { accion, hoyBogota, type TareaHoy } from "@/lib/hoy/clasificar";
import { HOY_POR_EMPRESA } from "@/lib/hoy/datos";

export interface Resultado {
  tipo: "pendiente" | "unidad" | "reserva";
  id: string;
  titulo: string;
  detalle: string;
  /** Adónde lleva; sin href se abre el asistente con la pregunta. */
  href?: string;
  pregunta?: string;
}

/**
 * Búsqueda de ⌘K: pendientes, unidades y reservas que la persona puede ver.
 * Pasa por la función de permisos igual que las pantallas.
 */
export async function buscarGlobal(db: Db, s: Sesion, texto: string, airtable?: ClienteAirtable): Promise<Resultado[]> {
  const q = texto.trim().replace(/[%_]/g, "");
  if (q.length < 2) return [];
  const t = `%${q}%`;
  const salida: Resultado[] = [];
  const numero = /^\d+$/.test(q) ? Number(q) : null;

  for (const [empresa, conf] of Object.entries(HOY_POR_EMPRESA)) {
    if (!puede(s, empresa, conf.modulo, "ver")) continue;
    const filas = (await db
      .select()
      .from(tareas)
      .where(and(inArray(tareas.empresa, [conf.tabla]), inArray(tareas.estado, ["Abierto", "En espera"]), or(ilike(tareas.asunto, t), ilike(tareas.detalle, t), ...(numero !== null ? [inArray(tareas.numero, [numero])] : []))))
      .limit(20)) as unknown as TareaHoy[];
    for (const f of filtrarSuyo(filas, s, empresa).slice(0, 8)) {
      salida.push({
        tipo: "pendiente",
        id: f.recId,
        titulo: f.asunto ?? "Sin asunto",
        detalle: [f.numero ? `#${f.numero}` : null, f.responsable, accion(f)].filter(Boolean).join(" · "),
        href: `/${empresa}/general/hoy?fila=${f.recId}`,
      });
    }
  }

  const lineas = [puede(s, "verse", "host-unidades", "ver") ? "Host" : null, puede(s, "verse", "living-unidades", "ver") ? "Living" : null].filter(Boolean) as ("Host" | "Living")[];
  if (lineas.length) {
    const us = await db
      .select()
      .from(unidades)
      .where(and(inArray(unidades.linea, lineas), or(ilike(unidades.unidad, t), ilike(unidades.edificio, t))))
      .limit(8);
    for (const u of us) {
      salida.push({
        tipo: "unidad",
        id: u.recId,
        titulo: u.unidad ?? "Unidad",
        detalle: [u.linea, u.edificio, u.estado].filter(Boolean).join(" · "),
        pregunta: `¿Qué reservas tiene ${u.unidad} esta semana?`,
      });
    }
  }

  if (airtable && q.length >= 3 && puede(s, "verse", "host-operacion", "ver")) {
    const hoy = hoyBogota();
    const r = await buscarReservas(airtable, s, { unidad: q, desde: hoy }, hoy).catch(() => null);
    if (r && "reservas" in r) {
      for (const x of (r.reservas ?? []).slice(0, 6)) {
        const f = x as Record<string, unknown>;
        const unidad = String(f["Unidad"] ?? "");
        salida.push({
          tipo: "reserva",
          id: String(f["ID Reserva"] ?? `${unidad}-${f["Ingreso"]}`),
          titulo: `${unidad || "Reserva"} · ${String(f["Ingreso"] ?? "")} a ${String(f["Salida"] ?? "")}`,
          detalle: [f["Plataforma"], f["Noches"] ? `${f["Noches"]} noches` : null].filter(Boolean).join(" · "),
          pregunta: `Dame el detalle de la reserva ${String(f["ID Reserva"] ?? "")} de ${unidad}.`,
        });
      }
    }
  }
  return salida;
}
