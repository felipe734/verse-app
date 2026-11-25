import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { enviarAFirma, revisarContrato, type Conexion } from "@/lib/contratos/firma";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const C = ESCRITURA.contratos;
const living: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000041", correo: "alejandra@prueba.co", estado: "activo", maestro: false, nombreAirtable: "Alejandra", accesos: { verse: plantilla("living").casillas }, estructura: ESTRUCTURA };
const maestro: Sesion = { ...living, correo: "felipe@prueba.co", nombreAirtable: "Felipe", maestro: true };

let db: Db;
let at: AirtableFalso;
let llamadas: { url: string; cuerpo: Record<string, unknown> | null; auth: string | null }[];

function conexion(respuestas: Record<string, { status: number; datos: unknown }>): Conexion {
  return {
    url: "https://docs.prueba",
    token: "secreto",
    fetch: (async (url: string, init?: RequestInit) => {
      if (url === "https://airtable/contrato.pdf") return new Response(Buffer.from("%PDF-1.7 contrato"));
      const ruta = url.replace("https://docs.prueba", "");
      llamadas.push({ url: ruta, cuerpo: init?.body ? JSON.parse(String(init.body)) : null, auth: new Headers(init?.headers).get("authorization") });
      const r = respuestas[ruta] ?? { status: 404, datos: {} };
      return new Response(JSON.stringify(r.datos), { status: r.status });
    }) as typeof fetch,
  };
}

beforeEach(async () => {
  db = await dbDePrueba();
  at = new AirtableFalso();
  llamadas = [];
});

describe("firma por verse-docs", () => {
  it("revisa el PDF del contrato y devuelve el token; solo el Maestro envía y queda anotado", async () => {
    const c = at.poner(C.idBase, C.idTabla, { [C.campos.contratoId.id]: "VL_301_03", [C.campos.contrato.id]: [{ id: "att1", url: "https://airtable/contrato.pdf" }] });
    const cx = conexion({
      "/api/revisar": { status: 200, datos: { resultado: "ok", mensaje: "Revisión OK. Puedes enviar a firma.", token: "tok123", hallazgos: [], firmantes: [{ rol: "Contraparte", name: "Residente" }] } },
      "/api/enviar": { status: 200, datos: { code: "AUCO1", mensaje: "Enviado." } },
    });
    const r = await revisarContrato(db, at, living, c.id, cx);
    expect(r).toMatchObject({ ok: true, resultado: "ok", token: "tok123", puedeEnviar: false });
    expect(llamadas[0]).toMatchObject({ url: "/api/revisar", auth: "Bearer secreto", cuerpo: { nombre: "VL_301_03", pdfBase64: Buffer.from("%PDF-1.7 contrato").toString("base64") } });

    expect((await enviarAFirma(db, at, living, c.id, "tok123", "whatsapp", cx)).mensaje).toBe("Solo Felipe envía contratos a firma");
    const e = await enviarAFirma(db, at, maestro, c.id, "tok123", "whatsapp", cx);
    expect(e).toMatchObject({ ok: true, code: "AUCO1" });
    expect(llamadas.at(-1)).toMatchObject({ url: "/api/enviar", cuerpo: { token: "tok123", modo: "whatsapp", contratoRecordId: c.id } });
    const f = at.tablas.get(`${C.idBase}/${C.idTabla}`)!.get(c.id)!.fields;
    expect(f).toMatchObject({ [C.campos.aucoCode.id]: "AUCO1", [C.campos.aucoEstado.id]: "Enviado" });
    expect(String(f[C.campos.aucoLog.id])).toContain("Enviado a firma desde Verse App por Felipe (whatsapp)");

    expect((await revisarContrato(db, at, living, c.id, cx)).mensaje).toBe("Este contrato ya se envió a firma");
  });

  it("sin PDF, sin clave o con alerta no hay token", async () => {
    const sin = at.poner(C.idBase, C.idTabla, { [C.campos.contratoId.id]: "VL_202_01" });
    const cx = conexion({ "/api/revisar": { status: 200, datos: { resultado: "alerta", mensaje: "Revisión con alerta.", token: null, hallazgos: [{ severidad: "alta", descripcion: "Canon distinto" }] } } });
    expect((await revisarContrato(db, at, living, sin.id, cx)).mensaje).toBe("El contrato no tiene PDF. Genéralo primero");
    expect((await revisarContrato(db, at, living, sin.id, null)).mensaje).toBe("Falta conectar verse-docs (VERSE_DOCS_TOKEN en Vercel)");
    const c = at.poner(C.idBase, C.idTabla, { [C.campos.contrato.id]: [{ id: "att2", url: "https://airtable/contrato.pdf" }] });
    const r = await revisarContrato(db, at, living, c.id, cx);
    expect(r).toMatchObject({ ok: true, resultado: "alerta", token: null });
    expect(r.hallazgos?.[0]?.descripcion).toBe("Canon distinto");
  });
});
