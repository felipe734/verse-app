import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { propuestas, tareas } from "@/db/esquema";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import type { Sesion } from "@/lib/acceso/permisos";
import { auditar } from "@/lib/auditoria";
import { aplicarAccion, type ResultadoAccion } from "@/lib/hoy/acciones";
import { HOY_POR_EMPRESA } from "@/lib/hoy/datos";
import { prepararAdjuntos, puedeDrive, type Adjunto } from "@/lib/drive/drive";
import type { ClienteComposio } from "./composio";
import { cuentaPorId, cuentasConectadas } from "./cuentas";
import { nivelEnCuenta, ProponerCorreo, vistaPrevia, type DatosCorreo } from "./redactar";

export interface Edicion {
  asunto: string;
  cuerpo: string;
}

/**
 * Guarda el borrador en Gmail o envía el correo de una propuesta, cuando la persona lo
 * confirma en la tarjeta. Revisa el permiso otra vez, toma la propuesta una sola vez (no se
 * envía dos veces aunque se toque dos veces), busca el asunto en enviados de 7 días antes de
 * enviar y deja todo en AUDITORIA. Si salió de un pendiente con link de Gmail, lo cierra.
 */
export async function ejecutarCorreo(opciones: {
  db: Db;
  composio: ClienteComposio;
  airtable: ClienteAirtable;
  sesion: Sesion;
  id: string;
  modo: "borrador" | "enviar";
  edicion?: Edicion;
}): Promise<ResultadoAccion> {
  const { db, composio, sesion: s, id, modo } = opciones;
  const [p] = await db.select().from(propuestas).where(and(eq(propuestas.id, id), eq(propuestas.usuarioId, s.usuarioId)));
  if (!p || p.tipo !== "correo") return { ok: false, mensaje: "Ese correo no existe" };
  if (p.estado !== "pendiente") return { ok: false, mensaje: "Ese correo ya se respondió" };

  const original = p.datos as unknown as DatosCorreo;
  const revisado = ProponerCorreo.safeParse({ ...original, ...(opciones.edicion ?? {}) });
  if (!revisado.success) return { ok: false, mensaje: "El asunto o el texto no son válidos" };
  const d: DatosCorreo = { ...revisado.data, firma: original.firma };
  const cuenta = cuentaPorId(d.cuenta)!;

  const nivel = nivelEnCuenta(s, d.cuenta);
  if (modo === "enviar" && nivel !== "enviar") return { ok: false, mensaje: `No tienes permiso para enviar desde ${cuenta.correo}. Guarda el borrador` };
  if (nivel !== "enviar" && nivel !== "redactar") return { ok: false, mensaje: `No tienes permiso para redactar desde ${cuenta.correo}` };

  if (d.adjuntos?.length && !puedeDrive(s)) return { ok: false, mensaje: "Adjuntar de Drive es para quien envía correo" };

  const { mapa } = await cuentasConectadas(composio);
  const conectada = mapa.get(d.cuenta);
  if (!conectada) return { ok: false, mensaje: `La cuenta ${cuenta.correo} no está conectada en Composio` };

  // Se toma la propuesta antes de llamar a Gmail: un segundo toque ya no la encuentra pendiente.
  const tomada = await db
    .update(propuestas)
    .set({ estado: "hecha", resultado: "En curso" })
    .where(and(eq(propuestas.id, id), eq(propuestas.estado, "pendiente")))
    .returning({ id: propuestas.id });
  if (!tomada.length) return { ok: false, mensaje: "Ese correo ya se respondió" };

  const [primero, ...demas] = d.para;
  const destinos = { recipient_email: primero, extra_recipients: demas, cc: d.cc ?? [] };
  const herramienta = modo === "borrador" ? "GMAIL_CREATE_EMAIL_DRAFT" : d.hilo ? "GMAIL_REPLY_TO_THREAD" : "GMAIL_SEND_EMAIL";
  let r: ResultadoAccion;
  let adjuntos: Adjunto[] = [];
  let enlaces: { nombre: string; url: string }[] = [];
  try {
    if (d.adjuntos?.length) ({ adjuntos, enlaces } = await prepararAdjuntos(composio, d.adjuntos, herramienta));
    // Lo que no se pudo adjuntar va como enlace al final del texto.
    const cuerpo = enlaces.length ? `${d.cuerpo}\n\n${enlaces.map((e) => `${e.nombre}: ${e.url}`).join("\n")}` : d.cuerpo;
    const html = vistaPrevia({ ...d, cuerpo });
    const adjunto = adjuntos.length ? { attachment: adjuntos } : {};
    if (modo === "enviar") {
      if (!d.hilo) {
        const enviados = await composio.ejecutar("GMAIL_FETCH_EMAILS", conectada, {
          query: `in:sent subject:"${d.asunto.replace(/"/g, "")}" newer_than:7d`,
          max_results: 5,
          verbose: false,
          include_payload: false,
        });
        const previo = ((enviados.messages as { subject?: string; messageTimestamp?: string }[] | undefined) ?? []).find((m) => (m.subject ?? "").trim() === d.asunto);
        if (previo) {
          r = { ok: false, mensaje: `Ya salió un correo con ese asunto el ${previo.messageTimestamp?.slice(0, 10) ?? "esta semana"}. No se repitió` };
          await terminar(db, id, r, "fallida");
          return r;
        }
        await composio.ejecutar("GMAIL_SEND_EMAIL", conectada, { ...destinos, subject: d.asunto, body: html, is_html: true, include_signature: false, ...adjunto });
      } else {
        await composio.ejecutar("GMAIL_REPLY_TO_THREAD", conectada, { ...destinos, thread_id: d.hilo, message_body: html, is_html: true, include_signature: false, timezone: "America/Bogota", ...adjunto });
      }
      r = { ok: true, mensaje: `Enviado desde ${cuenta.correo}${notaAdjuntos(adjuntos.length, enlaces.length)}` };
    } else {
      await composio.ejecutar("GMAIL_CREATE_EMAIL_DRAFT", conectada, {
        ...destinos,
        // En un hilo, el asunto vacío deja el borrador en el mismo hilo.
        subject: d.hilo ? "" : d.asunto,
        ...(d.hilo ? { thread_id: d.hilo, timezone: "America/Bogota" } : {}),
        body: html,
        is_html: true,
        include_signature: false,
        ...adjunto,
      });
      r = { ok: true, mensaje: `Borrador guardado en ${cuenta.correo}${notaAdjuntos(adjuntos.length, enlaces.length)}` };
    }
  } catch (e) {
    console.error("[correo]", e instanceof Error ? e.message : e);
    // Un envío que falló a medias pudo salir: no se reintenta solo.
    r = { ok: false, mensaje: modo === "enviar" ? "Gmail no confirmó el envío. Revisa Enviados antes de intentar otra vez" : "No se pudo guardar el borrador. Intenta de nuevo" };
    await terminar(db, id, r, "fallida");
    return r;
  }

  await auditar(db, {
    autor: s.correo,
    accion: modo === "enviar" ? "correo.enviado" : "correo.borrador",
    despues: {
      cuenta: d.cuenta,
      para: d.para,
      cc: d.cc ?? [],
      asunto: d.asunto,
      hilo: d.hilo ?? null,
      editado: Boolean(opciones.edicion),
      adjuntos: adjuntos.map((a) => a.name),
      enlaces: enlaces.map((e) => e.nombre),
    },
    detalle: `${cuenta.correo} → ${d.para.join(", ")} · ${d.asunto}`,
  });

  if (modo === "enviar" && d.pendiente) {
    const cierre = await cerrarPendiente(db, opciones.airtable, s, d.pendiente);
    if (cierre) r = { ok: true, mensaje: `${r.mensaje}. ${cierre}` };
  }
  await terminar(db, id, r, "hecha");
  return r;
}

function notaAdjuntos(adjuntos: number, enlaces: number): string {
  const partes = [adjuntos && `${adjuntos} ${adjuntos === 1 ? "adjunto" : "adjuntos"}`, enlaces && `${enlaces} como enlace de Drive`].filter(Boolean);
  return partes.length ? `, con ${partes.join(" y ")}` : "";
}

async function terminar(db: Db, id: string, r: ResultadoAccion, estado: "hecha" | "fallida") {
  await db.update(propuestas).set({ estado, resultado: r.mensaje }).where(eq(propuestas.id, id));
}

/** Plan: "si salió de un pendiente con link de Gmail, el pendiente queda Hecho". */
async function cerrarPendiente(db: Db, airtable: ClienteAirtable, s: Sesion, p: { empresa: string; numero: number }): Promise<string | null> {
  const conf = HOY_POR_EMPRESA[p.empresa];
  if (!conf) return null;
  const [t] = await db
    .select({ recId: tareas.recId, link: tareas.link, estado: tareas.estado })
    .from(tareas)
    .where(and(eq(tareas.empresa, conf.tabla), eq(tareas.numero, p.numero)));
  if (!t || !t.link?.includes("mail.google.com") || !["Abierto", "En espera"].includes(t.estado ?? "")) return null;
  const r = await aplicarAccion(db, airtable, s, t.recId, { tipo: "cerrar" });
  return r.ok ? `Pendiente ${p.numero} cerrado` : `El pendiente ${p.numero} sigue abierto: ${r.mensaje}`;
}
