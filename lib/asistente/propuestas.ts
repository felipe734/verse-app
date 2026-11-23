import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras, propuestas } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { TABLAS } from "@/lib/airtable/mapeo";
import { puede, type Sesion } from "@/lib/acceso/permisos";
import { aplicarAccion, type ResultadoAccion } from "@/lib/hoy/acciones";
import { HOY_POR_EMPRESA } from "@/lib/hoy/datos";
import { nivelAsistente } from "./herramientas";

/** Proceso por defecto cuando el pendiente no encaja en otro (convención de verse-trazabilidad). */
const PROCESO_POR_DEFECTO: Record<string, string> = { verse: "Verse OS", cyc: "C&C OS" };

/**
 * Ejecuta una propuesta del asistente cuando la persona la confirma. Vuelve a revisar el
 * permiso en este momento: si cambió desde que se propuso, no se ejecuta.
 */
export async function confirmarPropuesta(db: Db, cliente: ClienteAirtable, s: Sesion, id: string): Promise<ResultadoAccion> {
  const [p] = await db.select().from(propuestas).where(and(eq(propuestas.id, id), eq(propuestas.usuarioId, s.usuarioId)));
  if (!p) return { ok: false, mensaje: "Esa propuesta no existe" };
  if (p.estado !== "pendiente") return { ok: false, mensaje: "Esa propuesta ya se respondió" };

  let r: ResultadoAccion;
  if (p.tipo === "cambio_pendiente") {
    const d = p.datos as { recId: string; accion: "cerrar" | "aplazar" | "descartar"; hasta?: string };
    r = await aplicarAccion(db, cliente, s, d.recId, d.accion === "aplazar" ? { tipo: "aplazar", hasta: d.hasta ?? "" } : { tipo: d.accion });
  } else if (p.tipo === "nuevo_pendiente") {
    r = await crearPendiente(db, cliente, s, p.datos as unknown as NuevoPendiente);
  } else {
    r = { ok: false, mensaje: "Tipo de propuesta desconocido" };
  }

  await db
    .update(propuestas)
    .set({ estado: r.ok ? "hecha" : "fallida", resultado: r.mensaje })
    .where(eq(propuestas.id, id));
  return r;
}

export async function rechazarPropuesta(db: Db, s: Sesion, id: string): Promise<ResultadoAccion> {
  const hechas = await db
    .update(propuestas)
    .set({ estado: "rechazada", resultado: "Cancelada por la persona" })
    .where(and(eq(propuestas.id, id), eq(propuestas.usuarioId, s.usuarioId), eq(propuestas.estado, "pendiente")))
    .returning({ id: propuestas.id });
  return hechas.length ? { ok: true, mensaje: "Cancelado" } : { ok: false, mensaje: "Esa propuesta ya se respondió" };
}

interface NuevoPendiente {
  empresa: "verse" | "cyc";
  asunto: string;
  detalle: string;
  responsable: string;
  fecha_limite: string;
  linea: string;
  proceso?: string;
}

async function crearPendiente(db: Db, cliente: ClienteAirtable, s: Sesion, d: NuevoPendiente): Promise<ResultadoAccion> {
  const conf = HOY_POR_EMPRESA[d.empresa];
  if (!conf || nivelAsistente(s, d.empresa) !== "acciones" || !puede(s, d.empresa, conf.modulo, "editar")) {
    return { ok: false, mensaje: "No tienes permiso para crear pendientes aquí" };
  }
  const tabla = d.empresa === "verse" ? TABLAS.trazabilidadVerse : TABLAS.trazabilidadCyC;
  const k = tabla.campos;
  const idCola = await encolar(db, {
    idBase: tabla.idBase,
    idTabla: tabla.idTabla,
    autor: s.correo,
    campos: {
      [k.tipo.id]: "Pendiente",
      [k.estado.id]: "Abierto",
      [k.asunto.id]: d.asunto,
      [k.detalle.id]: d.detalle,
      [k.responsable.id]: d.responsable,
      [k.fechaLimite.id]: d.fecha_limite,
      [k.linea.id]: d.linea,
      [k.proceso.id]: d.proceso ?? PROCESO_POR_DEFECTO[d.empresa],
      [k.mes.id]: d.fecha_limite.slice(0, 7),
    },
  });
  await procesarCola(db, cliente);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, idCola));
  if (fila?.estado === "hecha") return { ok: true, mensaje: `Pendiente creado: ${d.asunto}` };
  if (fila?.estado === "pendiente") return { ok: true, mensaje: "Airtable está ocupado: se crea en un momento" };
  return { ok: false, mensaje: "Airtable no aceptó el pendiente. Revisa el Proceso o la Línea" };
}
