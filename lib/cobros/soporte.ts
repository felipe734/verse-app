import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import { auditar } from "@/lib/auditoria";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { puede, type Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";

/**
 * Soporte de un arriendo (fase 2.4): el comprobante se adjunta en INGRESOS › Soporte sin
 * quitar los que ya había. Si el cobro seguía POR PAGAR, queda PAGO con Fecha pago de hoy y
 * Marcado por. Va por la cola con el Estado que se vio: si Airtable cambió, gana Airtable.
 */

export const MODULO_COBROS = "living-cobros";
const I = ESCRITURA.ingresosLiving;
const REC = /^rec[A-Za-z0-9]{14}$/;

export interface Resultado {
  ok: boolean;
  mensaje: string;
}

const nombreEstado = (v: unknown): string => (v && typeof v === "object" && "name" in v ? String((v as { name: unknown }).name) : typeof v === "string" ? v : "");

export async function adjuntarSoporte(db: Db, airtable: ClienteAirtable, s: Sesion, recId: string, archivo: { url: string; nombre: string }): Promise<Resultado> {
  if (!puede(s, "verse", MODULO_COBROS, "editar")) return { ok: false, mensaje: "No puedes registrar pagos" };
  if (!REC.test(recId)) return { ok: false, mensaje: "Cobro inválido" };
  const fila = await airtable.obtener(I.idBase, I.idTabla, recId);
  if (!fila) return { ok: false, mensaje: "El cobro ya no existe en Airtable" };
  const c = I.campos;
  const previos = Array.isArray(fila.fields[c.soporte.id]) ? (fila.fields[c.soporte.id] as { id?: string }[]).filter((a) => a.id).map((a) => ({ id: a.id })) : [];
  const estadoAntes = fila.fields[c.estado.id] ?? null;
  const campos: Record<string, unknown> = { [c.soporte.id]: [...previos, { url: archivo.url, filename: archivo.nombre.slice(0, 200) || "soporte" }] };
  const quedaPago = nombreEstado(estadoAntes) !== "PAGO";
  if (quedaPago) {
    campos[c.estado.id] = "PAGO";
    campos[c.fechaPago.id] = hoyBogota();
    campos[c.marcadoPor.id] = s.nombreAirtable || s.correo;
  }
  const id = await encolar(db, { idBase: I.idBase, idTabla: I.idTabla, recId, campos, esperado: { [c.estado.id]: estadoAntes }, autor: s.correo });
  await procesarCola(db, airtable);
  const [r] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  if (r?.estado !== "hecha" && r?.estado !== "pendiente") return { ok: false, mensaje: r?.error?.includes("cambió") ? "El cobro cambió en Airtable; recarga" : "Airtable no aceptó el soporte" };
  await auditar(db, { autor: s.correo, accion: "cobros.soporte", idBase: I.idBase, idTabla: I.idTabla, recId, detalle: quedaPago ? "Soporte y PAGO" : "Soporte" });
  return { ok: true, mensaje: quedaPago ? "Soporte guardado y cobro en PAGO" : "Soporte guardado" };
}
