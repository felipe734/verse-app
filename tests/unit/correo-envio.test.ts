import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { auditoria, propuestas, usuarios } from "@/db/esquema";
import { TABLAS } from "@/lib/airtable/mapeo";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { ejecutar } from "@/lib/asistente/herramientas";
import { olvidarCuentas } from "@/lib/correo/cuentas";
import { ejecutarCorreo } from "@/lib/correo/enviar";
import { htmlCorreo } from "@/lib/correo/marca";
import { reconciliar } from "@/lib/sync/reconciliar";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { ComposioFalso } from "../apoyo/composio-falso";
import { dbDePrueba } from "../apoyo/db";

const TV = TABLAS.trazabilidadVerse;
const k = TV.campos;
const HOY = "2026-11-25";

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
  db = await dbDePrueba();
  at = new AirtableFalso();
  cp = new ComposioFalso();
  const [m, l] = await db
    .insert(usuarios)
    .values([
      { nombre: "M", correo: "m@prueba.co", estado: "activo", maestro: true, nombreAirtable: "Felipe" },
      { nombre: "L", correo: "l@prueba.co", estado: "activo", maestro: false, nombreAirtable: "Diana Prueba" },
    ])
    .returning();
  maestro = sesion(m!.id, {}, { maestro: true, correo: "m@prueba.co", nombreAirtable: "Felipe" });
  living = sesion(l!.id, { verse: { ...plantilla("living").casillas, asistente: "acciones" } }, { correo: "l@prueba.co" });
  at.poner(TV.idBase, TV.idTabla, {
    [k.id.id]: 310,
    [k.tipo.id]: "Pendiente",
    [k.estado.id]: "Abierto",
    [k.asunto.id]: "Estado de cuenta Teik",
    [k.responsable.id]: "Felipe",
    [k.fechaLimite.id]: HOY,
    [k.proceso.id]: "Verse OS",
    [k.link.id]: "https://mail.google.com/mail/u/0/#inbox/1a2063103bb432fa",
  });
  await reconciliar(db, at, "trazabilidadVerse");
});

const ctx = (s: Sesion) => ({ db, sesion: s, conversacionId: null, hoy: HOY, composio: cp, airtable: at });
const base = { cuenta: "verse-felipe", para: ["admin@ejemplo.co"], asunto: "Estado de cuenta del Teik", cuerpo: "Hola.\n\nNos ayudas con el estado de cuenta de noviembre?" };

describe("marca", () => {
  it("escapa el texto y lleva la franja y el pie", () => {
    const h = htmlCorreo({ empresa: "verse", submarca: "HOST", cuerpo: "Hola <b>x</b>\n\nOtro", firma: "Felipe", pie: "VERSE GROUP SAS · felipe@" });
    expect(h).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(h).not.toContain("<b>x</b>");
    expect(h).toContain('bgcolor="#002448"');
    expect(h).toContain("HOST");
    expect(htmlCorreo({ empresa: "cyc", cuerpo: "a", firma: "F", pie: "p" })).toContain("C&amp;C GROUP");
  });
});

describe("redactar", () => {
  it("proponer no toca Gmail; la tarjeta trae la vista previa y si puede enviar", async () => {
    const r = await ejecutar("proponer_correo", { ...base, pendiente: { empresa: "verse", numero: 310 } }, ctx(maestro));
    expect(r.propuesta?.correo).toMatchObject({ de: "felipe@verseliving.com", puedeEnviar: true, firma: "Felipe", respuesta: false });
    expect(r.propuesta?.correo?.html).toContain("Nos ayudas con el estado de cuenta");
    expect(cp.llamadas).toHaveLength(0);
  });

  it("solo desde las cuentas que la persona redacta", async () => {
    const r = await ejecutar("proponer_correo", base, ctx(living));
    expect(r.error).toBe(true);
    expect(JSON.parse(r.contenido).error).toContain("Puede desde: contacto@verseliving.com");
    const ok = await ejecutar("proponer_correo", { ...base, cuenta: "verse-contacto" }, ctx(living));
    expect(ok.propuesta?.correo).toMatchObject({ puedeEnviar: false, firma: "Diana" });
  });

  it("sin signos de admiración en el asunto", async () => {
    const r = await ejecutar("proponer_correo", { ...base, asunto: "Urgente!" }, ctx(maestro));
    expect(r.error).toBe(true);
  });
});

describe("guardar y enviar", () => {
  async function propuesta(s: Sesion, extra: Record<string, unknown> = {}) {
    await ejecutar("proponer_correo", { ...base, ...extra }, ctx(s));
    const [p] = await db.select().from(propuestas);
    return p!.id;
  }

  it("enviar revisa duplicados, envía con la cuenta explícita, audita y cierra el pendiente con link de Gmail", async () => {
    const id = await propuesta(maestro, { pendiente: { empresa: "verse", numero: 310 } });
    const r = await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: maestro, id, modo: "enviar", edicion: { asunto: base.asunto, cuerpo: "Hola.\n\nTexto editado." } });
    expect(r).toEqual({ ok: true, mensaje: "Enviado desde felipe@verseliving.com. Pendiente 310 cerrado" });
    expect(cp.llamadas.map((l) => [l.herramienta, l.cuenta])).toEqual([
      ["GMAIL_FETCH_EMAILS", "ca_felipe"],
      ["GMAIL_SEND_EMAIL", "ca_felipe"],
    ]);
    expect(cp.llamadas[1]!.argumentos).toMatchObject({ recipient_email: "admin@ejemplo.co", is_html: true, include_signature: false, subject: base.asunto });
    expect(String(cp.llamadas[1]!.argumentos.body)).toContain("Texto editado.");
    const [a] = await db.select().from(auditoria);
    expect(a).toMatchObject({ accion: "correo.enviado", autor: "m@prueba.co" });
    const fila = [...at.tablas.get(`${TV.idBase}/${TV.idTabla}`)!.values()][0]!;
    expect(fila.fields[k.estado.id]).toBe("Hecho");
    // Un segundo toque no vuelve a enviar.
    expect((await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: maestro, id, modo: "enviar" })).mensaje).toBe("Ese correo ya se respondió");
    expect(cp.llamadas.filter((l) => l.herramienta === "GMAIL_SEND_EMAIL")).toHaveLength(1);
  });

  it("si el asunto ya salió en 7 días, no se repite", async () => {
    cp.enviados.set("ca_felipe", [{ subject: base.asunto, messageTimestamp: "2026-11-24T10:00:00Z" }]);
    const id = await propuesta(maestro);
    const r = await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: maestro, id, modo: "enviar" });
    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain("2026-11-24");
    expect(cp.llamadas.some((l) => l.herramienta === "GMAIL_SEND_EMAIL")).toBe(false);
  });

  it("una respuesta va al hilo y el borrador queda en el mismo hilo", async () => {
    const id = await propuesta(maestro, { hilo: "1a2063103bb432fa" });
    expect((await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: maestro, id, modo: "borrador" })).mensaje).toBe("Borrador guardado en felipe@verseliving.com");
    expect(cp.llamadas[0]).toMatchObject({ herramienta: "GMAIL_CREATE_EMAIL_DRAFT", argumentos: { thread_id: "1a2063103bb432fa", subject: "" } });
    const [a] = await db.select().from(auditoria);
    expect(a?.accion).toBe("correo.borrador");
  });

  it("quien solo redacta guarda borrador pero no envía", async () => {
    const id = await propuesta(living, { cuenta: "verse-contacto" });
    const no = await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: living, id, modo: "enviar" });
    expect(no.mensaje).toContain("No tienes permiso para enviar");
    const si = await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: living, id, modo: "borrador" });
    expect(si.ok).toBe(true);
    expect(cp.llamadas.map((l) => l.cuenta)).toEqual(["ca_contacto"]);
  });

  it("nadie resuelve el correo de otra persona", async () => {
    const id = await propuesta(maestro);
    expect((await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: living, id, modo: "borrador" })).mensaje).toBe("Ese correo no existe");
  });

  it("si Gmail falla al enviar, no reintenta y pide revisar Enviados", async () => {
    const id = await propuesta(maestro, { hilo: "1a2063103bb432fa" });
    cp.fallaEn = "ca_felipe";
    const r = await ejecutarCorreo({ db, composio: cp, airtable: at, sesion: maestro, id, modo: "enviar" });
    expect(r.mensaje).toContain("Revisa Enviados");
    const [p] = await db.select().from(propuestas);
    expect(p?.estado).toBe("fallida");
  });
});
