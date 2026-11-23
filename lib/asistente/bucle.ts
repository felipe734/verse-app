import { asc, eq, sql } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/db/cliente";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { conversaciones, mensajesAsistente } from "@/db/esquema";
import type { Sesion } from "@/lib/acceso/permisos";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { definiciones, ejecutar, type Contexto } from "./herramientas";
import { costoUsd, MODELO_POR_DEFECTO } from "./precios";
import { SISTEMA } from "./prompt";

type ParamsStream = Anthropic.Beta.Messages.MessageCreateParamsStreaming;
type Bloque = Anthropic.Beta.BetaContentBlock;
type MensajeParam = Anthropic.Beta.BetaMessageParam;

/** Llamada al modelo con texto en vivo. En producción, client.beta.messages.stream; en pruebas, un falso. */
export type Llamar = (params: Omit<ParamsStream, "stream">, alTexto: (delta: string) => void) => Promise<Anthropic.Beta.BetaMessage>;

export type Evento =
  | { tipo: "conversacion"; id: string }
  | { tipo: "texto"; delta: string }
  | { tipo: "herramienta"; nombre: string }
  | { tipo: "propuesta"; id: string; resumen: string }
  | { tipo: "aviso"; texto: string }
  | { tipo: "fin"; costoUsd: number };

export interface Pantalla {
  ruta: string;
  seleccion?: string | null;
}

const MAX_VUELTAS = 8;
const HISTORIA = 40;

/** Parámetros fijos: modelo del doc, respaldo del servidor ante rechazos y caché del prefijo. */
function parametros(modelo: string, mensajes: MensajeParam[]): Omit<ParamsStream, "stream"> {
  return {
    model: modelo,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
    tools: definiciones(),
    messages: [...mensajes],
    cache_control: { type: "ephemeral" },
  } as Omit<ParamsStream, "stream">;
}

async function historia(db: Db, conversacionId: string): Promise<MensajeParam[]> {
  const filas = await db
    .select({ rol: mensajesAsistente.rol, contenido: mensajesAsistente.contenido, id: mensajesAsistente.id })
    .from(mensajesAsistente)
    .where(eq(mensajesAsistente.conversacionId, conversacionId))
    .orderBy(asc(mensajesAsistente.id));
  // Se reenvía tal cual (append-only): los bloques de razonamiento solo sirven sin cambios.
  const ultimos = filas.slice(-HISTORIA);
  // La historia debe empezar con un mensaje de la persona que no sea solo resultados de herramientas.
  const inicio = ultimos.findIndex((f) => f.rol === "user" && !(Array.isArray(f.contenido) && (f.contenido as { type: string }[]).every((b) => b.type === "tool_result")));
  return ultimos.slice(Math.max(inicio, 0)).map((f) => ({ role: f.rol, content: f.contenido }) as MensajeParam);
}

async function guardar(db: Db, conversacionId: string, rol: "user" | "assistant", contenido: unknown, uso?: { modelo: string; uso: Anthropic.Beta.BetaUsage }) {
  await db.insert(mensajesAsistente).values({
    conversacionId,
    rol,
    contenido,
    modelo: uso?.modelo ?? null,
    tokensEntrada: uso?.uso.input_tokens ?? 0,
    tokensSalida: uso?.uso.output_tokens ?? 0,
    tokensCacheLeidos: uso?.uso.cache_read_input_tokens ?? 0,
    tokensCacheEscritos: uso?.uso.cache_creation_input_tokens ?? 0,
    costoUsd: uso ? costoUsd(uso.modelo, uso.uso) : 0,
  });
}

/**
 * Una vuelta de conversación: guarda el mensaje de la persona, llama al modelo, ejecuta
 * herramientas (que nunca escriben: proponen) y repite hasta la respuesta final.
 */
export async function conversar(opciones: {
  db: Db;
  sesion: Sesion;
  llamar: Llamar;
  texto: string;
  pantalla?: Pantalla;
  conversacionId?: string | null;
  modelo?: string;
  /** Cliente de Airtable para las herramientas que leen en el momento (reservas, cierre). */
  airtable?: ClienteAirtable;
  alEvento: (e: Evento) => void;
  ahora?: Date;
}): Promise<{ conversacionId: string; costoUsd: number }> {
  const { db, sesion, llamar, alEvento } = opciones;
  const modelo = opciones.modelo ?? MODELO_POR_DEFECTO;

  let conversacionId = opciones.conversacionId ?? null;
  if (conversacionId) {
    const [c] = await db.select().from(conversaciones).where(eq(conversaciones.id, conversacionId));
    if (!c || c.usuarioId !== sesion.usuarioId) conversacionId = null;
  }
  if (!conversacionId) {
    const [c] = await db.insert(conversaciones).values({ usuarioId: sesion.usuarioId }).returning({ id: conversaciones.id });
    conversacionId = c!.id;
  }
  alEvento({ tipo: "conversacion", id: conversacionId });

  const hoy = hoyBogota(opciones.ahora);
  const encabezado = [`Fecha de hoy en Bogotá: ${hoy}.`, opciones.pantalla ? `Pantalla: ${opciones.pantalla.ruta}${opciones.pantalla.seleccion ? ` · seleccionado: ${opciones.pantalla.seleccion}` : ""}.` : null]
    .filter(Boolean)
    .join(" ");
  const mensajeUsuario: MensajeParam = { role: "user", content: [{ type: "text", text: `${encabezado}\n\n${opciones.texto}` }] };
  await guardar(db, conversacionId, "user", mensajeUsuario.content);

  const mensajes = [...(await historia(db, conversacionId))];
  const ctx: Contexto = { db, sesion, conversacionId, hoy, airtable: opciones.airtable };
  let total = 0;

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const r = await llamar(parametros(modelo, mensajes), (delta) => alEvento({ tipo: "texto", delta }));
    const contenido = r.content as Bloque[];
    await guardar(db, conversacionId, "assistant", contenido, { modelo: r.model, uso: r.usage });
    total += costoUsd(r.model, r.usage);
    mensajes.push({ role: "assistant", content: contenido } as MensajeParam);

    if (r.stop_reason === "refusal") {
      alEvento({ tipo: "aviso", texto: "No puedo ayudar con eso." });
      break;
    }
    if (r.stop_reason === "pause_turn") continue;
    const usos = contenido.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!usos.length) break;
    if (r.stop_reason === "max_tokens") {
      alEvento({ tipo: "aviso", texto: "La respuesta quedó cortada. Intenta con una pregunta más corta." });
      break;
    }

    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of usos) {
      alEvento({ tipo: "herramienta", nombre: u.name });
      const res = await ejecutar(u.name, u.input, ctx).catch((e: unknown) => ({
        contenido: JSON.stringify({ error: e instanceof Error ? e.message : "falló la herramienta" }),
        error: true,
        propuesta: undefined,
      }));
      if (res.propuesta) alEvento({ tipo: "propuesta", ...res.propuesta });
      resultados.push({ type: "tool_result", tool_use_id: u.id, content: res.contenido, ...(res.error ? { is_error: true } : {}) });
    }
    // Todos los resultados en un solo mensaje, para no frenar las llamadas en paralelo.
    await guardar(db, conversacionId, "user", resultados);
    mensajes.push({ role: "user", content: resultados });
  }

  await db.update(conversaciones).set({ actualizado: sql`now()` }).where(eq(conversaciones.id, conversacionId));
  alEvento({ tipo: "fin", costoUsd: total });
  return { conversacionId, costoUsd: total };
}
