"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { lectorHaiku } from "@/lib/contratos/cedula";
import { conexionVerseDocs, enviarAFirma, revisarContrato } from "@/lib/contratos/firma";
import { borrador, generarContrato, opcionesContrato, puedeContratos, type Resultado } from "@/lib/contratos/generar";
import { llenar, MODELOS, TIPOS_DOC, type DatosContrato } from "@/lib/contratos/llenar";
import { pdfContrato } from "@/lib/contratos/pdf";
import { crearContador } from "@/lib/medicion/contador";
import { clienteServidor } from "@/lib/servidor/airtable";
import { guardarArchivo, urlDeLectura } from "@/lib/servidor/blob";

const RUTA = "/verse/living/contratos";

async function conCliente<T>(f: (a: ReturnType<typeof clienteServidor>) => Promise<T>): Promise<T> {
  const contador = crearContador();
  const r = await f(clienteServidor(contador, { fresco: true }));
  await contador.volcar(db());
  return r;
}

const fallo = (e: unknown, donde: string) => {
  console.error(`[contratos/${donde}]`, e instanceof Error ? e.message : e);
  return "Airtable no respondió. Intenta de nuevo";
};

export async function opcionesContratoAccion() {
  const s = await sesionActual();
  if (!puedeContratos(s)) return { error: "No puedes generar contratos" };
  try {
    return await conCliente((a) => opcionesContrato(a));
  } catch (e) {
    return { error: fallo(e, "opciones") };
  }
}

export async function borradorAccion(unidadRecId: string, datosRecId: string) {
  const s = await sesionActual();
  if (!puedeContratos(s)) return { error: "No puedes generar contratos" };
  try {
    return await conCliente((a) => borrador(a, String(unidadRecId), String(datosRecId)));
  } catch (e) {
    return { error: fallo(e, "borrador") };
  }
}

const opc = z.string().max(300).optional();
const Datos = z.object({
  modelo: z.enum(Object.keys(MODELOS) as [keyof typeof MODELOS, ...(keyof typeof MODELOS)[]]),
  nombre: z.string().max(200),
  tipoDoc: z.enum(Object.keys(TIPOS_DOC) as [keyof typeof TIPOS_DOC, ...(keyof typeof TIPOS_DOC)[]]),
  numeroDoc: z.string().max(40),
  lugarExpedicion: opc,
  correo: z.string().max(200),
  whatsapp: z.string().max(40),
  numero: z.string().max(10),
  parqueadero: opc,
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meses: z.number().int(),
  canon: z.number(),
  admin: z.number().optional(),
  referenciaPago: opc,
  matricula: opc,
  contadorEnel: opc,
  contratoEaab: opc,
  diasPreaviso: z.number().int().optional(),
});

export async function generarContratoAccion(unidadRecId: string, datosRecId: string, datos: DatosContrato, sinValidar = false): Promise<Resultado> {
  const s = await sesionActual();
  const p = Datos.safeParse(datos);
  if (!p.success) return { ok: false, mensaje: "Datos del contrato inválidos" };
  try {
    const r = await conCliente((a) =>
      generarContrato(db(), a, s, { unidadRecId: String(unidadRecId), datosRecId: String(datosRecId), datos: p.data, sinValidar: Boolean(sinValidar) }, {
        leer: lectorHaiku(),
        pdf: (d) => pdfContrato(llenar(d)),
        guardar: async (pdf, nombre) => urlDeLectura(await guardarArchivo(`contratos/${nombre}`, pdf, "application/pdf")),
      }),
    );
    if (r.ok) revalidatePath(RUTA);
    return r;
  } catch (e) {
    return { ok: false, mensaje: fallo(e, "generar") };
  }
}

export async function revisarContratoAccion(recId: string) {
  const s = await sesionActual();
  try {
    return await conCliente((a) => revisarContrato(db(), a, s, String(recId), conexionVerseDocs()));
  } catch (e) {
    console.error("[contratos/revisar]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "verse-docs no respondió. Intenta de nuevo" };
  }
}

export async function enviarAFirmaAccion(recId: string, token: string, modo: "whatsapp" | "enlaces") {
  const s = await sesionActual();
  try {
    const r = await conCliente((a) => enviarAFirma(db(), a, s, String(recId), String(token), modo === "enlaces" ? "enlaces" : "whatsapp", conexionVerseDocs()));
    if (r.ok) revalidatePath(RUTA);
    return r;
  } catch (e) {
    console.error("[contratos/enviar]", e instanceof Error ? e.message : e);
    return { ok: false, mensaje: "verse-docs no respondió. Revisa en Contratos si quedó enviado antes de reintentar" };
  }
}
