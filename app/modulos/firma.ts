"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { llamarAuco, secretoWebhook } from "@/lib/firma/auco";
import { conectarWebhook, enviarAFirma, prepararFirma, type Preparacion } from "@/lib/firma/firma";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";

const RUTA = "/verse/living/contratos";

async function conCliente<T>(f: (a: ReturnType<typeof clienteServidor>) => Promise<T>): Promise<T> {
  const contador = crearContador();
  const r = await f(clienteServidor(contador, { fresco: true }));
  await contador.volcar(db());
  return r;
}

export async function prepararFirmaAccion(recId: string): Promise<Preparacion> {
  const s = await sesionActual();
  try {
    const r = await conCliente((a) => prepararFirma(a, s, String(recId)));
    // Al navegador solo va quién firma; la URL del PDF y la validación se quedan en el servidor.
    return { ok: r.ok, mensaje: r.mensaje, contrato: r.contrato, firmantes: r.firmantes, puedeEnviar: r.puedeEnviar };
  } catch (e) {
    console.error("[firma/preparar]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "Airtable no respondió. Intenta de nuevo" };
  }
}

export async function enviarAFirmaAccion(recId: string, modo: "whatsapp" | "enlaces") {
  const s = await sesionActual();
  try {
    const r = await conCliente((a) =>
      enviarAFirma(db(), a, s, String(recId), modo === "enlaces" ? "enlaces" : "whatsapp", {
        auco: llamarAuco(),
        celularFirmante: process.env.FIRMANTE_CELULAR ?? "",
        descargar: async (url) => {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`No se pudo descargar el PDF (${r.status})`);
          return Buffer.from(await r.arrayBuffer());
        },
      }),
    );
    if (r.ok) revalidatePath(RUTA);
    return r;
  } catch (e) {
    console.error("[firma/enviar]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "No se pudo enviar. Revisa en Contratos si quedó enviado antes de reintentar" };
  }
}

/** Ajustes › Conexiones: que Auco avise a la app (una vez; reemplaza el aviso de verse-docs). */
export async function conectarAucoAccion(): Promise<{ ok: boolean; mensaje: string }> {
  const s = await sesionActual();
  if (!s.maestro) return { ok: false, mensaje: "Solo el Maestro conecta Auco" };
  const auco = llamarAuco();
  const secreto = secretoWebhook();
  if (!auco || !secreto) return { ok: false, mensaje: "Faltan las variables de Auco en Vercel" };
  const host = process.env.PUBLIC_HOST || "app.verseliving.com";
  try {
    return await conectarWebhook(auco, `https://${host}/api/auco/webhook`, secreto);
  } catch (e) {
    console.error("[firma/conectar]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "Auco no respondió" };
  }
}
