import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras, tareas } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { TABLAS } from "@/lib/airtable/mapeo";
import { filtrarSuyo, puede, puedeAprobar, type Sesion } from "@/lib/acceso/permisos";
import { esAprobar, hoyBogota, type TareaHoy } from "./clasificar";
import { HOY_POR_EMPRESA } from "./datos";

/**
 * Acciones de Hoy y Para aprobar. Todo va a Airtable por la cola, con autor y auditoría;
 * si la fila cambió en Airtable, gana Airtable y la pantalla vuelve al valor real.
 * Convenciones de verse-trazabilidad: cerrar = Hecho, aplazar = En espera con nueva
 * Fecha límite, descartar = Descartado.
 */
export type Accion =
  | { tipo: "cerrar" }
  | { tipo: "aplazar"; hasta: string }
  | { tipo: "descartar" }
  | { tipo: "aprobar" }
  | { tipo: "rechazar" };

export interface ResultadoAccion {
  ok: boolean;
  mensaje: string;
}

export const MARCA_APROBADO = "Aprobado en la app";

const EMPRESA_APP: Record<string, string> = { Verse: "verse", "C&C": "cyc" };

export function fechaLegible(f: string): string {
  return new Date(`${f}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export function yaAprobada(detalle: string | null): boolean {
  return (detalle ?? "").includes(`\n${MARCA_APROBADO} `);
}

export async function aplicarAccion(
  db: Db,
  cliente: ClienteAirtable,
  s: Sesion,
  recId: string,
  accion: Accion,
  ahora = new Date(),
): Promise<ResultadoAccion> {
  const [t] = await db.select().from(tareas).where(eq(tareas.recId, recId));
  if (!t) return { ok: false, mensaje: "Ese pendiente ya no está" };
  const empresa = EMPRESA_APP[t.empresa];
  const conf = empresa ? HOY_POR_EMPRESA[empresa] : undefined;
  if (!empresa || !conf) return { ok: false, mensaje: "Empresa desconocida" };

  const aprobacion = accion.tipo === "aprobar" || accion.tipo === "rechazar";
  if (aprobacion) {
    if (!puedeAprobar(s, empresa)) return { ok: false, mensaje: "No tienes permiso para aprobar" };
    if (!esAprobar(t)) return { ok: false, mensaje: "Esta fila no es una aprobación" };
    if (t.estado !== "Abierto" || yaAprobada(t.detalle)) return { ok: false, mensaje: "Esta aprobación ya se respondió" };
  } else {
    if (!puede(s, empresa, conf.modulo, "editar")) return { ok: false, mensaje: "No tienes permiso para cambiar pendientes" };
    if (filtrarSuyo([t as TareaHoy], s, empresa).length === 0) return { ok: false, mensaje: "Ese pendiente no es tuyo" };
    if (t.tipo !== "Pendiente" || !["Abierto", "En espera"].includes(t.estado ?? "")) return { ok: false, mensaje: "Ese pendiente ya está cerrado" };
  }

  const tabla = t.empresa === "Verse" ? TABLAS.trazabilidadVerse : TABLAS.trazabilidadCyC;
  const k = tabla.campos;
  const hoy = hoyBogota(ahora);
  const firma = `${s.correo} el ${hoy}`;
  let campos: Record<string, unknown>;
  let mensaje: string;
  switch (accion.tipo) {
    case "cerrar":
      campos = { [k.estado.id]: "Hecho" };
      mensaje = "Cerrado";
      break;
    case "aplazar":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(accion.hasta) || accion.hasta <= hoy) return { ok: false, mensaje: "Elige una fecha después de hoy" };
      campos = { [k.estado.id]: "En espera", [k.fechaLimite.id]: accion.hasta };
      mensaje = `Aplazado hasta el ${fechaLegible(accion.hasta)}`;
      break;
    case "descartar":
      campos = { [k.estado.id]: "Descartado" };
      mensaje = "Descartado";
      break;
    case "aprobar":
      // verse-os aplica el cambio con la skill dueña; la app deja la aprobación escrita en la fila.
      campos = { [k.detalle.id]: `${t.detalle}\n${MARCA_APROBADO} por ${firma}` };
      mensaje = "Aprobado. Verse OS aplica el cambio con la skill dueña";
      break;
    case "rechazar":
      campos = { [k.estado.id]: "Descartado", [k.detalle.id]: `${t.detalle}\nRechazado en la app por ${firma}` };
      mensaje = "Rechazado";
      break;
  }

  const esperado: Record<string, unknown> = { [k.estado.id]: t.estado };
  if (aprobacion) esperado[k.detalle.id] = t.detalle;
  const idCola = await encolar(db, { idBase: tabla.idBase, idTabla: tabla.idTabla, recId, campos, esperado, autor: s.correo });
  await procesarCola(db, cliente);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, idCola));
  if (fila?.estado === "hecha") return { ok: true, mensaje };
  if (fila?.estado === "pendiente") return { ok: true, mensaje: `${mensaje}. Airtable está ocupado: se envía en un momento` };
  return { ok: false, mensaje: fila?.error?.includes("cambió") ? "La fila cambió en Airtable; quedó el valor de Airtable" : "Airtable no aceptó el cambio" };
}
