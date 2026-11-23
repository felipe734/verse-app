import { and, ilike, inArray, or } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { tareas, unidades } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { filtrarSuyo, puede, type Sesion } from "@/lib/acceso/permisos";
import { buscarReservas } from "@/lib/asistente/vivo";
import { accion, hoyBogota, type TareaHoy } from "@/lib/hoy/clasificar";
import { HOY_POR_EMPRESA } from "@/lib/hoy/datos";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { REGISTRO, segmentoVertical } from "@/lib/modulos/registro";
import { leerTabla } from "@/lib/modulos/tabla";
import { leerFecha } from "@/lib/vistas/fechas";
import { leerPeriodo } from "@/lib/vistas/periodo";

export interface Resultado {
  tipo: "pendiente" | "unidad" | "reserva" | "registro";
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
  if (airtable && q.length >= 3) salida.push(...(await buscarEnModulos(airtable, s, q).catch(() => [])));
  return salida;
}

/** Módulos donde ⌘K busca por el nombre de la fila (contratos, actas, leads, contratistas, cobros). */
const BUSCABLES = ["contratos", "cobros", "actas", "contratistas", "comercial-host", "comercial-living", "liquidaciones"];

const literal = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/**
 * Busca en los módulos de tabla que la persona ve, por su campo título, sin período. El enlace
 * abre el módulo en el período de la fila y con la fila abierta.
 */
async function buscarEnModulos(airtable: ClienteAirtable, s: Sesion, q: string): Promise<Resultado[]> {
  const estructura = s.estructura ?? ESTRUCTURA;
  const hoy = hoyBogota();
  const tareasBusqueda = estructura.flatMap((e) =>
    e.verticales.flatMap((v) =>
      v.modulos
        .filter((m) => BUSCABLES.includes(m.tipo ?? "") && puede(s, e.id, m.id, "ver"))
        .map((m) => ({ e, v, m, def: REGISTRO.find((d) => d.tipo === m.tipo) }))
        .filter((x) => x.def?.tabla),
    ),
  );
  const listas = await Promise.all(
    tareasBusqueda.map(async ({ e, v, m, def }) => {
      const tabla = def!.tabla!;
      const formula = `FIND(LOWER('${literal(q)}'), LOWER(ARRAYJOIN({${tabla.titulo}})))`;
      const r = await leerTabla(airtable, s, e.id, v.id, { ...tabla, periodo: undefined, formula: () => formula, max: 4 }, hoy).catch(() => null);
      if (!r) return [];
      const base = `/${e.id}/${segmentoVertical(e.id, v.id)}/${def!.segmento}`;
      return r.filas.map((f): Resultado => {
        const fecha = tabla.periodo ? leerFecha(f.celdas[tabla.periodo.campo]) : null;
        const p = fecha && tabla.periodo ? leerPeriodo(tabla.periodo.unidad, undefined, fecha.fecha).clave : null;
        const params = new URLSearchParams({ v: "lista", quien: "todo", fila: f.id, ...(p ? { p } : {}) });
        const detalle = r.columnas
          .slice(1, 3)
          .map((c) => f.celdas[c.campo])
          .filter(Boolean)
          .join(" · ");
        return { tipo: "registro", id: f.id, titulo: f.celdas[tabla.titulo] || "—", detalle: `${m.nombre}${detalle ? ` · ${detalle}` : ""}`, href: `${base}?${params}` };
      });
    }),
  );
  return listas.flat().slice(0, 12);
}
