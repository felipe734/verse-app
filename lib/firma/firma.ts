import { eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { colaEscrituras } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { encolar, procesarCola } from "@/lib/airtable/cola";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import type { Sesion } from "@/lib/acceso/permisos";
import { auditar } from "@/lib/auditoria";
import { puedeContratos } from "@/lib/contratos/generar";
import { sha256, type LlamarAuco } from "./auco";
import { agregarPaginaFirmas } from "./pagina";

/**
 * Firma de contratos dentro de Verse App (rediseño R7, decisión de Felipe del 2026-11-25: sin
 * verse-docs). Los contratos que genera la app salen del modelo aprobado y la cédula ya la
 * validó Haiku, así que no hay segunda revisión con IA. Solo el Maestro envía (gasta un crédito
 * de Auco y le escribe al residente). Firma primero el residente (documento, cara y código por
 * WhatsApp) y después C&C GROUP SAS por correo. El aviso de Auco marca Firmado y deja el PDF
 * firmado en UNIDADES › Contrato Arriendo.
 */

const C = ESCRITURA.contratos;
const D = ESCRITURA.datosLiving;
const F = ESCRITURA.firmas;
const U = ESCRITURA.unidadesContrato;
const REC = /^rec[A-Za-z0-9]{14}$/;

export const EMPRESA_FIRMA = { razon: "C&C GROUP SAS", nit: "900.609.741-1", correo: "comercial@constructoraccgroup.com", representante: "Juan Felipe Tobar" };

const texto = (v: unknown): string => (v === null || v === undefined ? "" : Array.isArray(v) ? v.map(texto).filter(Boolean).join(", ") : typeof v === "object" && "name" in v ? String((v as { name: unknown }).name) : String(v));
const ahora = () => new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

export interface Firmante {
  rol: string;
  name: string;
  email: string;
  phone: string;
  identificacion?: string;
  tipoDoc?: string;
  pais?: string;
  detalle: string;
}

export interface Preparacion {
  ok: boolean;
  mensaje: string;
  contrato?: string;
  firmantes?: Firmante[];
  puedeEnviar?: boolean;
}

function celularIntl(c: string): string {
  const d = c.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  return d.length === 10 ? `+57${d}` : `+${d}`;
}

/** Lo que va a pasar al enviar: quién firma y con qué datos. No escribe nada. */
export async function prepararFirma(airtable: ClienteAirtable, s: Sesion, recId: string): Promise<Preparacion & { pdfUrl?: string; datos?: { contratoId: string; validacion: string } }> {
  if (!puedeContratos(s)) return { ok: false, mensaje: "No puedes ver la firma de contratos" };
  if (!REC.test(recId)) return { ok: false, mensaje: "Contrato inválido" };
  const fila = await airtable.obtener(C.idBase, C.idTabla, recId);
  if (!fila) return { ok: false, mensaje: "El contrato ya no existe en Airtable" };
  const k = C.campos;
  if (texto(fila.fields[k.aucoCode.id])) return { ok: false, mensaje: "Este contrato ya se envió a firma" };
  const pdf = Array.isArray(fila.fields[k.contrato.id]) ? (fila.fields[k.contrato.id] as { url?: string }[])[0]?.url : undefined;
  if (!pdf) return { ok: false, mensaje: "El contrato no tiene PDF. Genéralo primero" };
  const datosId = Array.isArray(fila.fields[k.nombre.id]) ? (fila.fields[k.nombre.id] as string[])[0] : undefined;
  const persona = datosId ? await airtable.obtener(D.idBase, D.idTabla, datosId) : null;
  const nombre = texto(persona?.fields[D.campos.nombreCompleto.id]).replace(/\s+/g, " ").trim();
  const cedula = texto(fila.fields[k.cedula.id]) || texto(persona?.fields[D.campos.cedula.id]);
  const correo = texto(fila.fields[k.correo.id]) || texto(persona?.fields[D.campos.correo.id]);
  const celular = texto(fila.fields[k.celular.id]) || texto(persona?.fields[D.campos.celular.id]);
  const faltan = [!nombre && "nombre", !cedula && "documento", !correo && "correo", !celular && "celular"].filter(Boolean);
  if (faltan.length) return { ok: false, mensaje: `Al residente le falta en DATOS: ${faltan.join(", ")}` };
  const tipoDoc = texto(fila.fields[k.tipoDoc.id]) || "CC";
  const residente: Firmante = {
    rol: "Arrendatario",
    name: nombre,
    email: correo,
    phone: celularIntl(celular),
    identificacion: cedula.replace(/[^\dA-Za-z]/g, ""),
    tipoDoc,
    pais: (texto(fila.fields[k.paisDocumento.id]) || "CO").toUpperCase(),
    detalle: `${tipoDoc} ${cedula}`,
  };
  const empresa: Firmante = { rol: EMPRESA_FIRMA.razon, name: EMPRESA_FIRMA.representante, email: EMPRESA_FIRMA.correo, phone: "", detalle: `Representante legal · NIT ${EMPRESA_FIRMA.nit}` };
  const contratoId = texto(fila.fields[k.contratoId.id]) || "Contrato";
  return { ok: true, mensaje: "Listo para firma", contrato: contratoId, firmantes: [residente, empresa], puedeEnviar: s.maestro, pdfUrl: pdf, datos: { contratoId, validacion: texto(fila.fields[k.validacion.id]) } };
}

async function escribir(db: Db, airtable: ClienteAirtable, autor: string, e: { idBase: string; idTabla: string; recId?: string; campos: Record<string, unknown>; esperado?: Record<string, unknown> }) {
  const id = await encolar(db, { ...e, autor });
  await procesarCola(db, airtable);
  const [fila] = await db.select().from(colaEscrituras).where(eq(colaEscrituras.id, id));
  return fila;
}

export interface Dependencias {
  auco: LlamarAuco | null;
  descargar: (url: string) => Promise<Buffer>;
  celularFirmante: string;
}

export async function enviarAFirma(db: Db, airtable: ClienteAirtable, s: Sesion, recId: string, modo: "whatsapp" | "enlaces", deps: Dependencias): Promise<{ ok: boolean; mensaje: string; code?: string }> {
  if (!s.maestro) return { ok: false, mensaje: "Solo Felipe envía contratos a firma" };
  if (!deps.auco) return { ok: false, mensaje: "Falta conectar Auco en Vercel (AUCO_ENV, AUCO_PUK, AUCO_PRK y FIRMANTE_CELULAR)" };
  const p = await prepararFirma(airtable, s, recId);
  if (!p.ok || !p.firmantes || !p.pdfUrl) return { ok: false, mensaje: p.mensaje };
  const original = await deps.descargar(p.pdfUrl);
  if (original.subarray(0, 5).toString() !== "%PDF-") return { ok: false, mensaje: "El archivo del contrato no es un PDF" };
  const hash = sha256(original);
  const firmantes = p.firmantes.map((f) => (f.rol === EMPRESA_FIRMA.razon ? { ...f, phone: deps.celularFirmante } : f));
  const conHoja = await agregarPaginaFirmas(original, { titulo: p.contrato!, hash, firmantes });
  const quien = s.nombreAirtable ?? s.correo;
  const [residente] = firmantes;

  // 1. Registro en FIRMAS, como hacía verse-docs, para tener un solo historial de firmas.
  const reg = await escribir(db, airtable, s.correo, {
    idBase: F.idBase,
    idTabla: F.idTabla,
    campos: {
      [F.campos.documento.id]: p.contrato,
      [F.campos.fecha.id]: new Date().toISOString(),
      [F.campos.resultado.id]: "OK",
      [F.campos.estado.id]: "Revisado",
      [F.campos.tipo.id]: "Contrato de arrendamiento",
      [F.campos.empresa.id]: EMPRESA_FIRMA.razon,
      [F.campos.contraparte.id]: [residente!.name, residente!.tipoDoc, residente!.identificacion].filter(Boolean).join(" · "),
      [F.campos.hallazgos.id]: "Generado en Verse App con el modelo aprobado; sin revisión con IA.",
      [F.campos.resumen.id]: p.datos?.validacion ?? "",
      [F.campos.subidoPor.id]: `Verse App · ${quien}`,
      [F.campos.hash.id]: hash,
    },
  });
  const firmaRecId = reg?.recId;
  if (!firmaRecId || (reg.estado !== "hecha" && reg.estado !== "pendiente")) return { ok: false, mensaje: "No se pudo registrar la firma en FIRMAS" };

  // 2. Proceso en Auco: primero el residente (documento + cara + código), luego la empresa (código por correo).
  const signProfile = firmantes.map((f, i) => {
    const base = { name: f.name, email: f.email, phone: f.phone, role: "SIGNER", order: String(i + 1), notification: modo !== "enlaces", position: [conHoja.posiciones[i]] };
    return f.identificacion
      ? { ...base, identification: f.identificacion, identificationType: f.tipoDoc, country: f.pais, camera: true, otpCode: true, options: { camera: "identification", otpCode: "phone", ...(modo === "whatsapp" ? { whatsapp: true, both: true } : {}) } }
      : { ...base, otpCode: true, options: { otpCode: "email" } };
  });
  const r = await deps.auco("/document/upload", {
    method: "POST",
    privada: true,
    body: {
      email: process.env.AUCO_CREADOR_EMAIL || "felipe@verseliving.com",
      name: p.contrato,
      subject: "Firma de tu contrato - Verse Living",
      message: "Te enviamos tu contrato de arrendamiento para firma electrónica.",
      remember: 24,
      expiredDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      notification: modo !== "enlaces",
      targetWebhooks: ["default"],
      custom: { firmaRecordId: firmaRecId, contratoRecordId: recId, origen: "verse-app" },
      file: conHoja.pdf.toString("base64"),
      signProfile,
    },
  });
  const code = typeof r.data.document === "string" ? r.data.document : "";
  if (!r.ok || !code) {
    await escribir(db, airtable, s.correo, { idBase: F.idBase, idTabla: F.idTabla, recId: firmaRecId, campos: { [F.campos.log.id]: `${ahora()} · Auco rechazó el envío (${r.status}): ${JSON.stringify(r.data).slice(0, 400)}` } });
    return { ok: false, mensaje: `Auco rechazó el proceso (${r.status})` };
  }

  // 3. Anotar el proceso en FIRMAS y en CONTRATO.
  const log = `${ahora()} · Enviado a firma desde Verse App por ${quien} (${modo}) · ${code}`;
  await escribir(db, airtable, s.correo, { idBase: F.idBase, idTabla: F.idTabla, recId: firmaRecId, campos: { [F.campos.aucoCode.id]: code, [F.campos.estado.id]: "Enviado a firma", [F.campos.log.id]: log } });
  await escribir(db, airtable, s.correo, { idBase: C.idBase, idTabla: C.idTabla, recId, campos: { [C.campos.aucoCode.id]: code, [C.campos.aucoEstado.id]: "Enviado", [C.campos.aucoLog.id]: log }, esperado: { [C.campos.aucoCode.id]: null } });
  await auditar(db, { autor: s.correo, accion: "contratos.enviado_a_firma", idBase: C.idBase, idTabla: C.idTabla, recId, detalle: `${p.contrato} · ${code} · ${modo}` });
  return { ok: true, code, mensaje: modo === "whatsapp" ? "Enviado. Auco le escribe al residente por WhatsApp y correo" : "Proceso creado sin aviso. Los enlaces están en Auco" };
}

const ESTADO_CONTRATO: Record<string, string> = { NOTIFICATION: "Firmó residente", REJECT: "Rechazado", REJECTED: "Rechazado", BLOCKED: "Bloqueado", EXPIRED: "Expirado", FINISH: "Firmado" };
const ESTADO_FIRMAS: Record<string, string> = { NOTIFICATION: "Firmó contraparte", REJECT: "Rechazado", REJECTED: "Rechazado", EXPIRED: "Expirado", FINISH: "Firmado" };

/** Aviso de Auco: se consulta el estado real del proceso y se actualizan FIRMAS, CONTRATO y UNIDADES. */
export async function procesarAviso(db: Db, airtable: ClienteAirtable, auco: LlamarAuco, ev: { code?: string; status?: string }): Promise<{ ok: boolean; estado?: string }> {
  if (!ev.code || !/^[\w-]{3,80}$/.test(ev.code)) return { ok: true };
  const r = await auco(`/document?code=${encodeURIComponent(ev.code)}`);
  if (!r.ok) return { ok: false };
  const d = r.data as { code?: string; status?: string; url?: string; name?: string; custom?: { firmaRecordId?: string; contratoRecordId?: string }; signProfile?: { name?: string; status?: string }[] };
  const fin = d.status === "FINISH";
  const firmantes = (d.signProfile ?? []).map((x) => `${x.name}: ${x.status}`).join(" · ");
  const autor = "auco";
  const custom = d.custom ?? {};

  if (custom.firmaRecordId && REC.test(custom.firmaRecordId)) {
    const reg = await airtable.obtener(F.idBase, F.idTabla, custom.firmaRecordId);
    const est = fin ? "Firmado" : ESTADO_FIRMAS[ev.status ?? ""];
    const campos: Record<string, unknown> = { [F.campos.log.id]: `${ahora()} · ${ev.status ?? "-"} · Auco ${d.status} · ${firmantes}\n${texto(reg?.fields[F.campos.log.id])}`.slice(0, 8000) };
    if (est) campos[F.campos.estado.id] = est;
    await escribir(db, airtable, autor, { idBase: F.idBase, idTabla: F.idTabla, recId: custom.firmaRecordId, campos });
  }

  if (custom.contratoRecordId && REC.test(custom.contratoRecordId)) {
    const recId = custom.contratoRecordId;
    const est = fin ? "Firmado" : ESTADO_CONTRATO[ev.status ?? ""];
    const campos: Record<string, unknown> = { [C.campos.aucoCode.id]: d.code };
    if (est) campos[C.campos.aucoEstado.id] = est;
    if (fin) campos[C.campos.estado.id] = "Firmado";
    const contrato = await airtable.obtener(C.idBase, C.idTabla, recId);
    await escribir(db, airtable, autor, { idBase: C.idBase, idTabla: C.idTabla, recId, campos });
    const unidad = Array.isArray(contrato?.fields[C.campos.unidad.id]) ? (contrato!.fields[C.campos.unidad.id] as string[])[0] : undefined;
    if (fin && d.url && unidad) {
      const u = await airtable.obtener(U.idBase, U.idTabla, unidad);
      const actuales = (Array.isArray(u?.fields[U.campos.contratoArriendo.id]) ? u!.fields[U.campos.contratoArriendo.id] : []) as { id?: string; filename?: string }[];
      if (!actuales.some((a) => (a.filename ?? "").includes(d.code ?? "-"))) {
        await escribir(db, airtable, autor, {
          idBase: U.idBase,
          idTabla: U.idTabla,
          recId: unidad,
          campos: { [U.campos.contratoArriendo.id]: [{ url: d.url, filename: `${d.name ?? d.code} FIRMADO ${d.code}.pdf` }, ...actuales.filter((a) => a.id).map((a) => ({ id: a.id }))] },
        });
      }
    }
  }
  await auditar(db, { autor, accion: "contratos.aviso_auco", idBase: C.idBase, idTabla: C.idTabla, recId: custom.contratoRecordId ?? null, detalle: `${d.code} · ${d.status}` });
  return { ok: true, estado: d.status };
}

/** Registra en Auco el aviso "default" apuntando a la app (reemplaza el de verse-docs). */
export async function conectarWebhook(auco: LlamarAuco, url: string, secreto: string): Promise<{ ok: boolean; mensaje: string }> {
  const r = await auco("/company", { method: "PUT", privada: true, body: { webhooks: [{ id: "default", description: "verse-app", url, header: { key: "x-verse-webhook", value: secreto } }] } });
  return r.ok ? { ok: true, mensaje: `Auco avisa ahora a ${url}` } : { ok: false, mensaje: `Auco rechazó el cambio (${r.status})` };
}
