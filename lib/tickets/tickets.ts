import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { puede, type Sesion } from "@/lib/acceso/permisos";
import { auditar } from "@/lib/auditoria";
import { sumarDias } from "@/lib/vistas/periodo";

/**
 * Tickets de las unidades (fase 1.5, plan aprobado por Felipe el 2026-11-24): tabla TICKETS de
 * 6. OPERACION 360. Se abren a mano desde el módulo o solos desde un reporte de la Ruta de aseo
 * con daños, implementos o actividades pendientes. Se asignan, comentan y cierran desde el
 * módulo (cerrar sella "Cerrado el"). Todo por la cola y en AUDITORIA.
 */

export const MODULO_TICKETS = "host-tickets";
const T = ESCRITURA.tickets;
const U = ESCRITURA.unidadesOperacion;
export const TIPOS = ["Daño", "Faltante", "Implementos", "Mantenimiento", "Huésped", "Otro"] as const;
export const PRIORIDADES = ["Alta", "Media", "Baja"] as const;
const PLAZO: Record<(typeof PRIORIDADES)[number], number> = { Alta: 1, Media: 3, Baja: 7 };
const REC = /^rec[A-Za-z0-9]{14}$/;

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

export interface NuevoTicket {
  titulo: string;
  unidad?: string;
  tipo: string;
  prioridad: string;
  responsable?: string;
  fechaLimite?: string;
  comentario?: string;
}

export const puedeTickets = (s: Sesion) => puede(s, "verse", MODULO_TICKETS, "editar");

/** Fecha límite por prioridad: Alta 1 día, Media 3, Baja 7. */
export const limitePorPrioridad = (prioridad: (typeof PRIORIDADES)[number], hoy: string) => sumarDias(hoy, PLAZO[prioridad]);

async function crear(db: Db, airtable: ClienteAirtable, autor: string, campos: Record<string, unknown>) {
  const id = await encolar(db, { idBase: T.idBase, idTabla: T.idTabla, campos, autor });
  await procesarCola(db, airtable);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  return { estado: fila?.estado, recId: fila?.recId ?? null };
}

/** Unidades activas para elegir al abrir un ticket. */
export async function unidadesActivas(airtable: ClienteAirtable): Promise<{ recId: string; nombre: string }[]> {
  const us = await airtable.consultar(U.idBase, U.idTabla, { campos: [U.campos.und.nombre], formula: `{${U.campos.estado.nombre}} = 'Actual'`, max: 300 });
  return us
    .map((u) => ({ recId: u.id, nombre: String(u.fields[U.campos.und.nombre] ?? "").trim() }))
    .filter((u) => u.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function crearTicket(db: Db, airtable: ClienteAirtable, s: Sesion, n: NuevoTicket, hoy: string): Promise<Resultado> {
  if (!puedeTickets(s)) return { ok: false, mensaje: "No puedes abrir tickets" };
  const titulo = n.titulo?.trim() ?? "";
  if (titulo.length < 3 || titulo.length > 200) return { ok: false, mensaje: "Escribe un título corto" };
  if (!TIPOS.includes(n.tipo as never)) return { ok: false, mensaje: "Elige el tipo" };
  if (!PRIORIDADES.includes(n.prioridad as never)) return { ok: false, mensaje: "Elige la prioridad" };
  if (n.unidad && !REC.test(n.unidad)) return { ok: false, mensaje: "Unidad inválida" };
  if (n.fechaLimite && !/^\d{4}-\d{2}-\d{2}$/.test(n.fechaLimite)) return { ok: false, mensaje: "La fecha límite no es válida" };
  if ((n.comentario?.length ?? 0) > 5000 || (n.responsable?.length ?? 0) > 100) return { ok: false, mensaje: "Texto muy largo" };
  const c = T.campos;
  const r = await crear(db, airtable, s.correo, {
    [c.titulo.id]: titulo,
    [c.tipo.id]: n.tipo,
    [c.prioridad.id]: n.prioridad,
    [c.estado.id]: "Abierto",
    [c.fechaLimite.id]: n.fechaLimite || limitePorPrioridad(n.prioridad as (typeof PRIORIDADES)[number], hoy),
    [c.creadoPor.id]: s.correo,
    ...(n.unidad ? { [c.unidad.id]: [n.unidad] } : {}),
    ...(n.responsable?.trim() ? { [c.responsable.id]: n.responsable.trim() } : {}),
    ...(n.comentario?.trim() ? { [c.comentario.id]: n.comentario.trim() } : {}),
  });
  if (r.estado !== "hecha" && r.estado !== "pendiente") return { ok: false, mensaje: "Airtable no aceptó el ticket" };
  await auditar(db, { autor: s.correo, accion: "tickets.abierto", idBase: T.idBase, idTabla: T.idTabla, recId: r.recId, detalle: titulo });
  return { ok: true, mensaje: r.estado === "pendiente" ? "Ticket guardado. Airtable lo recibe en un momento" : "Ticket abierto" };
}

export interface ReporteParaTicket {
  unidad: string;
  unidadRecId?: string;
  servicioRecId: string | null;
  estado: string;
  danos?: string;
  necesitaImplementos: boolean;
  implementos?: string;
  comentario?: string;
}

/**
 * Los tickets que abre un reporte de la Ruta: uno por daños, uno por implementos y uno por
 * actividades pendientes. Puro: devuelve los campos, no escribe.
 */
export function ticketsDeReporte(r: ReporteParaTicket, hoy: string): Record<string, unknown>[] {
  const c = T.campos;
  const base = (titulo: string, tipo: (typeof TIPOS)[number], prioridad: (typeof PRIORIDADES)[number], comentario: string) => ({
    [c.titulo.id]: titulo,
    [c.tipo.id]: tipo,
    [c.prioridad.id]: prioridad,
    [c.estado.id]: "Abierto",
    [c.fechaLimite.id]: limitePorPrioridad(prioridad, hoy),
    [c.creadoPor.id]: "Ruta de aseo",
    [c.comentario.id]: comentario,
    ...(r.unidadRecId ? { [c.unidad.id]: [r.unidadRecId] } : {}),
    ...(r.servicioRecId ? { [c.origen.id]: [r.servicioRecId] } : {}),
  });
  const t: Record<string, unknown>[] = [];
  if (r.danos?.trim()) t.push(base(`Daños en ${r.unidad}`, "Daño", "Alta", r.danos.trim()));
  if (r.necesitaImplementos) t.push(base(`Implementos para ${r.unidad}`, "Implementos", "Media", r.implementos?.trim() || "La funcionaria reportó que faltan implementos"));
  if (r.estado === "Actividades pendientes") t.push(base(`Actividades pendientes en ${r.unidad}`, "Mantenimiento", "Media", r.comentario?.trim() || "Quedaron actividades pendientes en el aseo"));
  return t;
}

/** Abre los tickets de un reporte. Un fallo no tumba el reporte: se registra y sigue. */
export async function abrirTicketsDeReporte(db: Db, airtable: ClienteAirtable, autor: string, r: ReporteParaTicket, hoy: string): Promise<number> {
  let n = 0;
  for (const campos of ticketsDeReporte(r, hoy)) {
    try {
      const x = await crear(db, airtable, autor, campos);
      if (x.estado === "hecha" || x.estado === "pendiente") {
        n++;
        await auditar(db, { autor, accion: "tickets.abierto", idBase: T.idBase, idTabla: T.idTabla, recId: x.recId, detalle: String(campos[T.campos.titulo.id]) });
      }
    } catch (e) {
      console.error("[tickets/reporte]", e instanceof Error ? e.message : e);
    }
  }
  return n;
}
