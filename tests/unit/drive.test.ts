import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { auditoria, propuestas, usuarios } from "@/db/esquema";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { ejecutar } from "@/lib/asistente/herramientas";
import { clienteComposio } from "@/lib/correo/composio";
import { olvidarCuentas } from "@/lib/correo/cuentas";
import { ejecutarCorreo } from "@/lib/correo/enviar";
import { buscarDrive, MAX_ADJUNTOS, olvidarDrive } from "@/lib/drive/drive";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { ComposioFalso } from "../apoyo/composio-falso";
import { dbDePrueba } from "../apoyo/db";

const HOY = "2026-11-25";
const POLIZA = "1AbCdEfGhIjKlMnOp_603";
const PLANO = "1PlanoGrandeXyz-0001";

let db: Db;
let at: AirtableFalso;
let cp: ComposioFalso;
let maestro: Sesion;
let living: Sesion;

const sesion = (id: string, accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: id,
  correo: "p@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Diana Prueba",
  accesos,
  ...extra,
});

beforeEach(async () => {
  olvidarCuentas();
  olvidarDrive();
  db = await dbDePrueba();
  at = new AirtableFalso();
  cp = new ComposioFalso();
  cp.archivos.set(POLIZA, { name: "Póliza 603.pdf", mimeType: "application/pdf", bytes: 2048 });
  cp.archivos.set(PLANO, { name: "Plano.dwg", mimeType: "application/acad", bytes: MAX_ADJUNTOS + 1 });
  const [m, l] = await db
    .insert(usuarios)
    .values([
      { nombre: "M", correo: "m@prueba.co", estado: "activo", maestro: true, nombreAirtable: "Felipe" },
      { nombre: "L", correo: "l@prueba.co", estado: "activo", maestro: false, nombreAirtable: "Diana Prueba" },
    ])
    .returning();
  maestro = sesion(m!.id, {}, { maestro: true, correo: "m@prueba.co", nombreAirtable: "Felipe" });
  // Living redacta desde contacto@ pero no envía desde ninguna cuenta.
  living = sesion(l!.id, { verse: { ...plantilla("living").casillas, asistente: "acciones" } }, { correo: "l@prueba.co" });
});

const ctx = (s: Sesion) => ({ db, sesion: s, conversacionId: null, hoy: HOY, composio: cp, airtable: at });
const base = { cuenta: "verse-felipe", para: ["admin@ejemplo.co"], asunto: "Póliza de la unidad 603", cuerpo: "Hola.\n\nTe comparto la póliza." };

async function propuesta(s: Sesion, extra: Record<string, unknown> = {}) {
  const r = await ejecutar("proponer_correo", { ...base, ...extra }, ctx(s));
  expect(r.error).toBeFalsy();
  const [p] = await db.select().from(propuestas);
  return { id: p!.id, tarjeta: r.propuesta?.correo };
}

describe("buscar en Drive", () => {
  it("quien envía busca, sin carpetas ni papelera, con la cuenta verse-drive", async () => {
    const r = await ejecutar("buscar_drive", { texto: "póliza" }, ctx(maestro));
    expect(r.error).toBeFalsy();
    expect(JSON.parse(r.contenido).archivos.map((a: { nombre: string }) => a.nombre)).toContain("Póliza 603.pdf");
    expect(cp.llamadas[0]).toMatchObject({ herramienta: "GOOGLEDRIVE_FIND_FILE", cuenta: "ca_drive" });
    expect(String(cp.llamadas[0]!.argumentos.q)).toContain("trashed = false and mimeType != 'application/vnd.google-apps.folder'");
  });

  it("quien no envía desde ninguna cuenta no busca", async () => {
    const r = await ejecutar("buscar_drive", { texto: "póliza" }, ctx(living));
    expect(r.error).toBe(true);
    expect(cp.llamadas).toHaveLength(0);
  });

  it("las comillas del texto no rompen la consulta", async () => {
    await buscarDrive(cp, maestro, "it's");
    expect(String(cp.llamadas[0]!.argumentos.q)).toContain("name contains 'it\\'s'");
  });

  it("sin la cuenta verse-drive lo dice", async () => {
    cp.drive = [{ id: "ca_otro", alias: "personal", wordId: null, estado: "ACTIVE" }];
    expect(await buscarDrive(cp, maestro, "póliza")).toEqual({ error: expect.stringContaining("verse-drive") });
  });
});

describe("adjuntar al correo", () => {
  it("la tarjeta muestra los adjuntos; quien no envía no adjunta", async () => {
    const { tarjeta } = await propuesta(maestro, { adjuntos: [{ id: POLIZA, nombre: "Póliza 603.pdf" }] });
    expect(tarjeta?.adjuntos).toEqual(["Póliza 603.pdf"]);
    const no = await ejecutar("proponer_correo", { ...base, cuenta: "verse-contacto", adjuntos: [{ id: POLIZA, nombre: "x" }] }, ctx(living));
    expect(no.error).toBe(true);
  });

  it("al enviar baja de Drive, sube para Gmail y adjunta", async () => {
    const { id } = await propuesta(maestro, { adjuntos: [{ id: POLIZA, nombre: "Póliza 603.pdf" }] });
    const r = await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: maestro, id, modo: "enviar" });
    expect(r).toEqual({ ok: true, mensaje: "Enviado desde felipe@verseliving.com, con 1 adjunto" });
    expect(cp.subidos).toEqual([{ toolkit: "gmail", herramienta: "GMAIL_SEND_EMAIL", nombre: "Póliza 603.pdf", mimetype: "application/pdf", largo: 2048 }]);
    const envio = cp.llamadas.find((l) => l.herramienta === "GMAIL_SEND_EMAIL")!;
    expect(envio.argumentos.attachment).toEqual([{ name: "Póliza 603.pdf", mimetype: "application/pdf", s3key: "subidos/Póliza 603.pdf" }]);
    const [a] = await db.select().from(auditoria);
    expect(a?.despues).toMatchObject({ adjuntos: ["Póliza 603.pdf"], enlaces: [] });
  });

  it("en una respuesta, el archivo se sube para la herramienta de responder", async () => {
    const { id } = await propuesta(maestro, { hilo: "1a2063103bb432fa", adjuntos: [{ id: POLIZA, nombre: "Póliza 603.pdf" }] });
    await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: maestro, id, modo: "enviar" });
    expect(cp.subidos[0]?.herramienta).toBe("GMAIL_REPLY_TO_THREAD");
    expect(cp.llamadas.find((l) => l.herramienta === "GMAIL_REPLY_TO_THREAD")?.argumentos.attachment).toHaveLength(1);
  });

  it("lo muy grande o lo que falla va como enlace de Drive en el texto", async () => {
    const { id } = await propuesta(maestro, { adjuntos: [{ id: PLANO, nombre: "Plano.dwg" }] });
    const r = await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: maestro, id, modo: "borrador" });
    expect(r.mensaje).toBe("Borrador guardado en felipe@verseliving.com, con 1 como enlace de Drive");
    const borrador = cp.llamadas.find((l) => l.herramienta === "GMAIL_CREATE_EMAIL_DRAFT")!;
    expect(borrador.argumentos.attachment).toBeUndefined();
    expect(String(borrador.argumentos.body)).toContain(`https://drive.google.com/file/d/${PLANO}/view`);
  });

  it("si la subida falla, también queda el enlace y el correo sale", async () => {
    cp.fallaSubida = true;
    const { id } = await propuesta(maestro, { adjuntos: [{ id: POLIZA, nombre: "Póliza 603.pdf" }] });
    const r = await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: maestro, id, modo: "enviar" });
    expect(r.ok).toBe(true);
    expect(String(cp.llamadas.find((l) => l.herramienta === "GMAIL_SEND_EMAIL")!.argumentos.body)).toContain(POLIZA);
  });
});

describe("cliente de archivos", () => {
  it("sube con md5 y PUT al enlace firmado; solo baja del almacenamiento de Composio", async () => {
    const pedidos: { url: string; init?: RequestInit }[] = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      pedidos.push({ url, init });
      if (url.endsWith("/files/upload/request")) return Response.json({ key: "k/1", new_presigned_url: "https://storage.composio.dev/put" });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const c = clienteComposio("clave", fetcher);
    const bytes = new TextEncoder().encode("hola");
    expect(await c.subirArchivo({ toolkit: "gmail", herramienta: "GMAIL_SEND_EMAIL", nombre: "a.pdf", mimetype: "application/pdf", bytes })).toBe("k/1");
    expect(JSON.parse(String(pedidos[0]!.init!.body))).toMatchObject({ toolkit_slug: "gmail", tool_slug: "GMAIL_SEND_EMAIL", md5: createHash("md5").update(bytes).digest("hex") });
    expect(pedidos[1]).toMatchObject({ url: "https://storage.composio.dev/put", init: { method: "PUT" } });
    await expect(c.bajar("https://evil.example/archivo", 10)).rejects.toThrow("almacenamiento");
  });
});

describe("errores de Composio", () => {
  it("el error trae el motivo que da Composio, con la clave ya enmascarada", async () => {
    const fetcher = (async () => Response.json({ error: { message: "Invalid API key: ak_**abcd", slug: "APIKey_InvalidAPIKey" } }, { status: 401 })) as unknown as typeof fetch;
    await expect(clienteComposio("clave", fetcher).cuentasGmail()).rejects.toThrow("Composio respondió 401 al listar cuentas: Invalid API key: ak_**abcd");
  });
});
