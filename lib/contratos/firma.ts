import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import type { Sesion } from "@/lib/acceso/permisos";
import { auditar } from "@/lib/auditoria";
import { puedeContratos } from "./generar";

/**
 * Firma del contrato por verse-docs (fase 2.3). La app no habla con Auco: le pasa el PDF de
 * CONTRATO › Contrato a verse-docs, que lo revisa con IA contra el modelo aprobado. Si sale con
 * alerta, verse-docs lo bloquea en FIRMAS y le escribe a Felipe. Si sale OK, solo el Maestro lo
 * envía (gasta un crédito de Auco y notifica a terceros). El webhook de verse-docs marca Firmado.
 */

const C = ESCRITURA.contratos;
const REC = /^rec[A-Za-z0-9]{14}$/;
const MAX = 3 * 1024 * 1024;

export interface Conexion {
  url: string;
  token: string;
  fetch: typeof fetch;
}

export function conexionVerseDocs(): Conexion | null {
  const token = process.env.VERSE_DOCS_TOKEN;
  if (!token) return null;
  return { url: (process.env.VERSE_DOCS_URL || "https://docs.verseliving.com").replace(/\/$/, ""), token, fetch };
}

export interface Hallazgo {
  severidad: string;
  descripcion: string;
  ubicacion?: string;
}

export interface Revision {
  ok: boolean;
  mensaje: string;
  resultado?: "ok" | "alerta";
  hallazgos?: Hallazgo[];
  firmaPor?: string | null;
  firmantes?: { rol: string; name: string; email?: string; phone?: string }[];
  /** Token firmado de verse-docs: solo sirve para enviar ESTE PDF, 24 h. */
  token?: string | null;
  /** Solo el Maestro envía a firma. */
  puedeEnviar?: boolean;
}

async function pdfDe(airtable: ClienteAirtable, cx: Conexion, recId: string) {
  const fila = await airtable.obtener(C.idBase, C.idTabla, recId);
  if (!fila) return { error: "El contrato ya no existe en Airtable" } as const;
  const adjunto = Array.isArray(fila.fields[C.campos.contrato.id]) ? (fila.fields[C.campos.contrato.id] as { url?: string }[])[0] : undefined;
  if (!adjunto?.url) return { error: "El contrato no tiene PDF. Genéralo primero" } as const;
  const r = await cx.fetch(adjunto.url);
  if (!r.ok) return { error: "No se pudo descargar el PDF de Airtable" } as const;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX) return { error: "El PDF supera 3 MB" } as const;
  if (buf.subarray(0, 5).toString() !== "%PDF-") return { error: "El archivo del contrato no es un PDF" } as const;
  const nombre = String(fila.fields[C.campos.contratoId.id] ?? "Contrato");
  return { fila, nombre, base64: buf.toString("base64"), aucoCode: String(fila.fields[C.campos.aucoCode.id] ?? "") } as const;
}

async function llamar(cx: Conexion, ruta: string, cuerpo: unknown): Promise<{ status: number; datos: Record<string, unknown> }> {
  const r = await cx.fetch(`${cx.url}${ruta}`, { method: "POST", headers: { Authorization: `Bearer ${cx.token}`, "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const datos = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: r.status, datos };
}

export async function revisarContrato(db: Db, airtable: ClienteAirtable, s: Sesion, recId: string, cx: Conexion | null): Promise<Revision> {
  if (!puedeContratos(s)) return { ok: false, mensaje: "No puedes revisar contratos" };
  if (!cx) return { ok: false, mensaje: "Falta conectar verse-docs (VERSE_DOCS_TOKEN en Vercel)" };
  if (!REC.test(recId)) return { ok: false, mensaje: "Contrato inválido" };
  const p = await pdfDe(airtable, cx, recId);
  if ("error" in p) return { ok: false, mensaje: p.error! };
  if (p.aucoCode) return { ok: false, mensaje: "Este contrato ya se envió a firma" };
  const r = await llamar(cx, "/api/revisar", { nombre: p.nombre, pdfBase64: p.base64 });
  if (r.status === 401) return { ok: false, mensaje: "verse-docs no reconoce la clave. Revisa VERSE_DOCS_TOKEN en Vercel" };
  if (r.status !== 200) return { ok: false, mensaje: String(r.datos.error ?? `verse-docs respondió ${r.status}`) };
  const resultado = r.datos.resultado === "ok" ? "ok" : "alerta";
  await auditar(db, { autor: s.correo, accion: "contratos.revisado", idBase: C.idBase, idTabla: C.idTabla, recId, detalle: `${p.nombre} · ${resultado}` });
  return {
    ok: true,
    resultado,
    mensaje: String(r.datos.mensaje ?? (resultado === "ok" ? "Revisión OK" : "Revisión con alerta")),
    hallazgos: (r.datos.hallazgos as Hallazgo[] | undefined) ?? [],
    firmaPor: (r.datos.firmaPor as string | null | undefined) ?? null,
    firmantes: (r.datos.firmantes as Revision["firmantes"]) ?? [],
    token: (r.datos.token as string | null | undefined) ?? null,
    puedeEnviar: s.maestro,
  };
}

export async function enviarAFirma(db: Db, airtable: ClienteAirtable, s: Sesion, recId: string, token: string, modo: "whatsapp" | "enlaces", cx: Conexion | null): Promise<{ ok: boolean; mensaje: string; code?: string }> {
  if (!s.maestro) return { ok: false, mensaje: "Solo Felipe envía contratos a firma" };
  if (!cx) return { ok: false, mensaje: "Falta conectar verse-docs (VERSE_DOCS_TOKEN en Vercel)" };
  if (!REC.test(recId) || !token || token.length > 20_000) return { ok: false, mensaje: "Datos inválidos" };
  const p = await pdfDe(airtable, cx, recId);
  if ("error" in p) return { ok: false, mensaje: p.error! };
  if (p.aucoCode) return { ok: false, mensaje: "Este contrato ya se envió a firma" };
  const r = await llamar(cx, "/api/enviar", { pdfBase64: p.base64, token, modo, contratoRecordId: recId });
  if (r.status !== 200) return { ok: false, mensaje: String(r.datos.error ?? `verse-docs respondió ${r.status}`) };
  const code = String(r.datos.code ?? "");
  const log = [String(p.fila.fields[C.campos.aucoLog.id] ?? ""), `${new Date().toISOString()} · Enviado a firma desde Verse App por ${s.nombreAirtable ?? s.correo} (${modo}) · ${code}`].filter(Boolean).join("\n");
  const id = await encolar(db, {
    idBase: C.idBase,
    idTabla: C.idTabla,
    recId,
    campos: { [C.campos.aucoCode.id]: code, [C.campos.aucoEstado.id]: "Enviado", [C.campos.aucoLog.id]: log },
    esperado: { [C.campos.aucoCode.id]: null },
    autor: s.correo,
  });
  await procesarCola(db, airtable);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  await auditar(db, { autor: s.correo, accion: "contratos.enviado_a_firma", idBase: C.idBase, idTabla: C.idTabla, recId, detalle: `${p.nombre} · ${code} · ${modo}` });
  const anotado = fila?.estado === "hecha" || fila?.estado === "pendiente";
  return { ok: true, code, mensaje: anotado ? String(r.datos.mensaje ?? "Enviado a firma") : `Enviado a firma (${code}), pero no se pudo anotar en CONTRATO` };
}
