import { nivelCorreo, puede, type Sesion } from "@/lib/acceso/permisos";
import type { ClienteComposio } from "./composio";
import { CUENTAS, cuentasConectadas, type Cuenta, type IdCuenta } from "./cuentas";
import { rutear, type Ruta } from "./ruteo";

/**
 * Bandeja ruteada: lo que llegó en las últimas horas a las cuentas que la persona puede leer,
 * cada correo con su OS y su cola (os-correo). Solo lectura.
 */

export interface CorreoBandeja {
  cuenta: IdCuenta;
  id: string;
  hilo: string;
  de: string;
  asunto: string;
  vista: string;
  fecha: string;
  noLeido: boolean;
  adjuntos: number;
  etiquetas: string[];
  ruta: Ruta;
  /** Otras cuentas a las que llegó el mismo correo. */
  tambienEn: IdCuenta[];
}

interface MensajeComposio {
  messageId?: string;
  threadId?: string;
  sender?: string;
  subject?: string;
  messageTimestamp?: string;
  labelIds?: string[];
  attachmentList?: unknown[];
  messageText?: string;
  preview?: { body?: string; subject?: string };
  to?: string;
}

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
export const sinEntidades = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTIDADES[m] ?? m);

/** Cuentas cuyo correo puede leer: módulo Correo de la empresa y la cuenta en leer o más. */
export function cuentasLegibles(s: Sesion): Cuenta[] {
  return CUENTAS.filter((c) => puede(s, c.empresa, `${c.empresa}-correo`, "ver") && nivelCorreo(s, c.empresa, c.id) !== "sin");
}

function aCorreo(cuenta: IdCuenta, m: MensajeComposio): Omit<CorreoBandeja, "ruta" | "tambienEn"> | null {
  if (!m.messageId || !m.threadId) return null;
  return {
    cuenta,
    id: m.messageId,
    hilo: m.threadId,
    de: m.sender ?? "",
    asunto: sinEntidades(m.subject ?? m.preview?.subject ?? "(sin asunto)"),
    vista: sinEntidades(m.preview?.body ?? "").slice(0, 240),
    fecha: m.messageTimestamp ?? "",
    noLeido: (m.labelIds ?? []).includes("UNREAD"),
    adjuntos: m.attachmentList?.length ?? 0,
    etiquetas: m.labelIds ?? [],
  };
}

const claveDuplicado = (c: { de: string; asunto: string; fecha: string }) => `${c.de.toLowerCase()}|${c.asunto.toLowerCase()}|${c.fecha.slice(0, 16)}`;

export async function bandejaDe(cliente: ClienteComposio, s: Sesion, opciones: { horas?: number; porCuenta?: number; cuenta?: string } = {}) {
  const horas = opciones.horas ?? 48;
  const legibles = cuentasLegibles(s).filter((c) => !opciones.cuenta || c.id === opciones.cuenta);
  const { mapa, faltan } = await cuentasConectadas(cliente);
  const avisos: string[] = faltan.filter((f) => legibles.some((l) => l.id === f)).map((f) => `La cuenta ${f} no está conectada en Composio.`);

  const lotes = await Promise.all(
    legibles
      .filter((c) => mapa.has(c.id))
      .map(async (c) => {
        try {
          const data = await cliente.ejecutar("GMAIL_FETCH_EMAILS", mapa.get(c.id)!, {
            query: `newer_than:${Math.max(1, Math.ceil(horas / 24))}d -in:sent -in:draft`,
            max_results: opciones.porCuenta ?? 40,
            verbose: false,
            include_payload: false,
          });
          return ((data.messages as MensajeComposio[] | undefined) ?? []).flatMap((m) => {
            const x = aCorreo(c.id, m);
            return x ? [x] : [];
          });
        } catch (e) {
          avisos.push(`No se pudo leer ${c.correo}: ${e instanceof Error ? e.message : "error"}`);
          return [];
        }
      }),
  );

  const limite = Date.now() - horas * 3_600_000;
  const vistos = new Map<string, CorreoBandeja>();
  for (const x of lotes.flat()) {
    if (x.fecha && Date.parse(x.fecha) < limite) continue;
    const k = claveDuplicado(x);
    const previo = vistos.get(k);
    if (previo) {
      previo.tambienEn.push(x.cuenta);
      continue;
    }
    vistos.set(k, { ...x, ruta: rutear({ cuenta: x.cuenta, de: x.de, asunto: x.asunto, vista: x.vista, etiquetas: x.etiquetas }), tambienEn: [] });
  }
  const correos = [...vistos.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const colas = new Map<string, CorreoBandeja[]>();
  let ruido = 0;
  for (const c of correos) {
    if (c.ruta.os === "ruido") {
      ruido++;
      continue;
    }
    const k = `${c.ruta.os}·${c.ruta.cola}`;
    colas.set(k, [...(colas.get(k) ?? []), c]);
  }
  return { horas, cuentas: legibles.map((c) => c.id), colas: [...colas.entries()].map(([id, items]) => ({ id, items })), ruido, avisos };
}

export interface MensajeHilo {
  id: string;
  de: string;
  para: string;
  asunto: string;
  fecha: string;
  texto: string;
  adjuntos: string[];
}

/** Un hilo, en texto (nunca HTML del remitente en la pantalla). */
export async function hiloDe(cliente: ClienteComposio, s: Sesion, cuenta: string, hilo: string): Promise<{ mensajes: MensajeHilo[] } | { error: string }> {
  const c = cuentasLegibles(s).find((x) => x.id === cuenta);
  if (!c) return { error: "Sin acceso a esa cuenta." };
  if (!/^[0-9a-f]{10,20}$/i.test(hilo)) return { error: "Hilo inválido." };
  const { mapa } = await cuentasConectadas(cliente);
  const id = mapa.get(c.id);
  if (!id) return { error: `La cuenta ${c.id} no está conectada en Composio.` };
  const data = await cliente.ejecutar("GMAIL_FETCH_MESSAGE_BY_THREAD_ID", id, { thread_id: hilo });
  const mensajes = ((data.messages as MensajeComposio[] | undefined) ?? [])
    .filter((m) => !(m.labelIds ?? []).includes("DRAFT"))
    .map((m) => ({
      id: m.messageId ?? "",
      de: m.sender ?? "",
      para: m.to ?? "",
      asunto: sinEntidades(m.subject ?? ""),
      fecha: m.messageTimestamp ?? "",
      texto: sinEntidades(m.messageText || m.preview?.body || "").slice(0, 20_000),
      adjuntos: ((m.attachmentList ?? []) as { filename?: string }[]).map((a) => a.filename ?? "adjunto"),
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { mensajes };
}
