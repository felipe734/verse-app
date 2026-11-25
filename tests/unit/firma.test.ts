import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import type { LlamarAuco } from "@/lib/firma/auco";
import { enviarAFirma, prepararFirma, procesarAviso } from "@/lib/firma/firma";
import { agregarPaginaFirmas } from "@/lib/firma/pagina";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const C = ESCRITURA.contratos;
const D = ESCRITURA.datosLiving;
const F = ESCRITURA.firmas;
const U = ESCRITURA.unidadesContrato;
const living: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000051", correo: "alejandra@prueba.co", estado: "activo", maestro: false, nombreAirtable: "Alejandra", accesos: { verse: plantilla("living").casillas }, estructura: ESTRUCTURA };
const maestro: Sesion = { ...living, correo: "felipe@prueba.co", nombreAirtable: "Felipe", maestro: true };

let db: Db;
let at: AirtableFalso;
let pdf: Buffer;
let llamadas: { ruta: string; body?: Record<string, unknown> }[];

const tabla = (t: { idBase: string; idTabla: string }) => at.tablas.get(`${t.idBase}/${t.idTabla}`)!;

function auco(respuestas: Record<string, { ok: boolean; status: number; data: Record<string, unknown> }>): LlamarAuco {
  return async (ruta, o = {}) => {
    llamadas.push({ ruta, body: o.body as Record<string, unknown> | undefined });
    const clave = Object.keys(respuestas).find((k) => ruta.startsWith(k));
    return clave ? respuestas[clave]! : { ok: false, status: 404, data: {} };
  };
}

beforeEach(async () => {
  db = await dbDePrueba();
  at = new AirtableFalso();
  llamadas = [];
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  pdf = Buffer.from(await doc.save());
});

function sembrar() {
  const u = at.poner(U.idBase, U.idTabla, { [U.campos.unidad.id]: "VL 301_03" });
  const d = at.poner(D.idBase, D.idTabla, { [D.campos.nombreCompleto.id]: "Felipe  Matías", [D.campos.cedula.id]: "1020304050", [D.campos.correo.id]: "r@prueba.co", [D.campos.celular.id]: "3001112233" });
  const c = at.poner(C.idBase, C.idTabla, { [C.campos.contratoId.id]: "VL_301_03", [C.campos.unidad.id]: [u.id], [C.campos.nombre.id]: [d.id], [C.campos.contrato.id]: [{ id: "att1", url: "https://airtable/c.pdf" }], [C.campos.tipoDoc.id]: "CC" });
  return { u, d, c };
}

describe("firma dentro de la app", () => {
  it("la página de firmas agrega una hoja y una caja por firmante", async () => {
    const r = await agregarPaginaFirmas(pdf, { titulo: "VL_301_03", hash: "abc", firmantes: [{ rol: "Arrendatario", name: "Ana" }, { rol: "C&C GROUP SAS", name: "Juan Felipe Tobar" }] });
    expect((await PDFDocument.load(r.pdf)).getPageCount()).toBe(2);
    expect(r.posiciones).toHaveLength(2);
    expect(r.posiciones[0]).toMatchObject({ page: 2, w: 210, h: 70 });
    expect(r.posiciones[1]!.x).toBeGreaterThan(r.posiciones[0]!.x);
  });

  it("prepara quién firma: el residente con su documento y C&C por correo", async () => {
    const { c } = sembrar();
    const p = await prepararFirma(at, living, c.id);
    expect(p).toMatchObject({ ok: true, contrato: "VL_301_03", puedeEnviar: false });
    expect(p.firmantes?.[0]).toMatchObject({ name: "Felipe Matías", phone: "+573001112233", identificacion: "1020304050", tipoDoc: "CC", pais: "CO" });
    expect(p.firmantes?.[1]).toMatchObject({ rol: "C&C GROUP SAS", email: "comercial@constructoraccgroup.com" });
  });

  it("solo el Maestro envía; queda en FIRMAS y en CONTRATO con el código de Auco", async () => {
    const { c } = sembrar();
    const deps = { auco: auco({ "/document/upload": { ok: true, status: 200, data: { document: "AUC123" } } }), descargar: async () => pdf, celularFirmante: "+573000000000" };
    expect((await enviarAFirma(db, at, living, c.id, "whatsapp", deps)).mensaje).toBe("Solo Felipe envía contratos a firma");
    const r = await enviarAFirma(db, at, maestro, c.id, "whatsapp", deps);
    expect(r).toMatchObject({ ok: true, code: "AUC123" });
    const envio = llamadas.find((l) => l.ruta === "/document/upload")!.body!;
    const perfiles = envio.signProfile as { phone: string; identification?: string; options: Record<string, unknown> }[];
    expect(perfiles[0]).toMatchObject({ identification: "1020304050", options: { camera: "identification", whatsapp: true } });
    expect(perfiles[1]).toMatchObject({ phone: "+573000000000", options: { otpCode: "email" } });
    expect((envio.custom as Record<string, string>).contratoRecordId).toBe(c.id);
    const firma = [...tabla(F).values()][0]!.fields;
    expect(firma).toMatchObject({ [F.campos.aucoCode.id]: "AUC123", [F.campos.estado.id]: "Enviado a firma", [F.campos.empresa.id]: "C&C GROUP SAS" });
    expect(tabla(C).get(c.id)!.fields).toMatchObject({ [C.campos.aucoCode.id]: "AUC123", [C.campos.aucoEstado.id]: "Enviado" });
    expect((await prepararFirma(at, maestro, c.id)).mensaje).toBe("Este contrato ya se envió a firma");
  });

  it("sin llaves de Auco no se envía", async () => {
    const { c } = sembrar();
    expect((await enviarAFirma(db, at, maestro, c.id, "whatsapp", { auco: null, descargar: async () => pdf, celularFirmante: "" })).mensaje).toContain("Falta conectar Auco");
  });

  it("el aviso de firmado marca el contrato y deja el PDF firmado en la unidad", async () => {
    const { u, c } = sembrar();
    const firma = at.poner(F.idBase, F.idTabla, { [F.campos.documento.id]: "VL_301_03" });
    const a = auco({ "/document?code=": { ok: true, status: 200, data: { code: "AUC123", status: "FINISH", url: "https://auco/firmado.pdf", name: "VL_301_03", custom: { firmaRecordId: firma.id, contratoRecordId: c.id }, signProfile: [{ name: "Ana", status: "SIGNED" }] } } });
    expect(await procesarAviso(db, at, a, { code: "AUC123", status: "FINISH" })).toEqual({ ok: true, estado: "FINISH" });
    expect(tabla(C).get(c.id)!.fields).toMatchObject({ [C.campos.estado.id]: "Firmado", [C.campos.aucoEstado.id]: "Firmado" });
    expect(tabla(F).get(firma.id)!.fields[F.campos.estado.id]).toBe("Firmado");
    expect(tabla(U).get(u.id)!.fields[U.campos.contratoArriendo.id]).toEqual([{ url: "https://auco/firmado.pdf", filename: "VL_301_03 FIRMADO AUC123.pdf" }]);
  });
});
