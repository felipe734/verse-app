import { describe, expect, it } from "vitest";
import { respaldoAdjuntos, respaldos } from "@/db/esquema";
import type { EsquemaTabla } from "@/lib/airtable/construir-mapeo";
import { guardarAdjuntos, registrarAdjuntos } from "@/lib/respaldo/adjuntos";
import { prepararDia, procesarDia } from "@/lib/respaldo/correr";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";
import { DriveFalso } from "../apoyo/drive-falso";

const esquema: EsquemaTabla = {
  id: "tblAAAAAAAAAAAAAA",
  name: "SERVICIOS",
  fields: [
    { id: "fldNombre", name: "Nombre", type: "singleLineText" },
    { id: "fldArchivos", name: "Archivos", type: "multipleAttachments" },
  ],
};
const origen = { idBase: "appAAAAAAAAAAAAAA", idTabla: "tblAAAAAAAAAAAAAA", base: "6. OPERACION 360", tabla: "SERVICIOS" };
const foto = { id: "attFOTO", url: "https://archivos.prueba/foto", filename: "foto.jpg", size: 5, type: "image/jpeg" };
const video = { id: "attVIDEO", url: "https://archivos.prueba/video", filename: "aseo.mp4", size: 9, type: "video/mp4" };
const registros = [{ id: "rec1", createdTime: "2026-11-01T00:00:00Z", fields: { fldNombre: "Servicio de prueba", fldArchivos: [foto, video] } }];

const descargas = (async (url: string | URL | Request) =>
  new Response(String(url).endsWith("foto") ? "bytes-foto" : "bytes-video", { headers: { "content-length": "10" } })) as typeof fetch;

describe("adjuntos", () => {
  it("los videos de limpieza (SERVICIOS y LIMPIEZA) nunca entran; sus fotos sí", async () => {
    const db = await dbDePrueba();
    await registrarAdjuntos(db, origen, esquema, registros);
    await registrarAdjuntos(db, { ...origen, tabla: "LIMPIEZA", idTabla: "tblLLLLLLLLLLLLLL" }, esquema, [
      { ...registros[0]!, id: "rec2", fields: { fldArchivos: [{ ...video, id: "attVIDEO2" }] } },
    ]);
    expect((await db.select().from(respaldoAdjuntos)).map((a) => a.idAdjunto)).toEqual(["attFOTO"]);
  });

  it("los videos de otras tablas sí entran", async () => {
    const db = await dbDePrueba();
    await registrarAdjuntos(db, { ...origen, tabla: "INVENTARIOS" }, esquema, registros);
    expect((await db.select().from(respaldoAdjuntos)).map((a) => a.idAdjunto).sort()).toEqual(["attFOTO", "attVIDEO"]);
  });

  it("cada adjunto se guarda una sola vez en Adjuntos/base/tabla", async () => {
    const db = await dbDePrueba();
    const drive = new DriveFalso();
    const at = new AirtableFalso();
    const inv = { ...origen, base: "5. INVENTARIO", tabla: "INVENTARIOS" };
    await registrarAdjuntos(db, inv, esquema, registros);
    const r = await guardarAdjuntos({ db, airtable: at, drive, idUnidad: "u", fetch: descargas }, "2026-11-22", Date.now() + 60_000);
    expect(r).toEqual({ guardados: 2, fallidos: 0, pendientes: 0 });
    expect(drive.archivos.map((a) => `${drive.ruta(a.padre)}/${a.name}`).sort()).toEqual([
      "u/Adjuntos/5. INVENTARIO/INVENTARIOS/attFOTO-foto.jpg",
      "u/Adjuntos/5. INVENTARIO/INVENTARIOS/attVIDEO-aseo.mp4",
    ]);

    await registrarAdjuntos(db, inv, esquema, registros);
    const otra = await guardarAdjuntos({ db, airtable: at, drive, idUnidad: "u", fetch: descargas }, "2026-11-29", Date.now() + 60_000);
    expect(otra.guardados).toBe(0);
    expect(drive.archivos).toHaveLength(2);
  });

  it("pide un enlace nuevo a Airtable si el guardado tiene más de una hora", async () => {
    const db = await dbDePrueba();
    const at = new AirtableFalso();
    at.poner(origen.idBase, origen.idTabla, { fldArchivos: [{ ...foto, url: "https://archivos.prueba/foto-nueva" }] }, "rec1");
    await registrarAdjuntos(db, origen, esquema, [{ ...registros[0]!, fields: { fldArchivos: [foto] } }]);
    const pedidas: string[] = [];
    const f = (async (url: string | URL | Request) => {
      pedidas.push(String(url));
      return new Response("bytes");
    }) as typeof fetch;
    await guardarAdjuntos({ db, airtable: at, drive: new DriveFalso(), idUnidad: "u", fetch: f, ahora: () => Date.now() + 2 * 3600_000 }, "2026-11-23", Date.now() + 3 * 3600_000);
    expect(pedidas).toEqual(["https://archivos.prueba/foto-nueva"]);
  });

  it("si el adjunto ya no existe en Airtable se olvida sin error", async () => {
    const db = await dbDePrueba();
    const at = new AirtableFalso();
    at.poner(origen.idBase, origen.idTabla, { fldArchivos: [] }, "rec1");
    await registrarAdjuntos(db, origen, esquema, [{ ...registros[0]!, fields: { fldArchivos: [foto] } }]);
    const r = await guardarAdjuntos({ db, airtable: at, drive: new DriveFalso(), idUnidad: "u", fetch: descargas, ahora: () => Date.now() + 2 * 3600_000 }, "2026-11-23", Date.now() + 3 * 3600_000);
    expect(r).toEqual({ guardados: 0, fallidos: 0, pendientes: 0 });
    expect(await db.select().from(respaldoAdjuntos)).toHaveLength(0);
  });

  it("una descarga que falla se reintenta y no frena las demás", async () => {
    const db = await dbDePrueba();
    await registrarAdjuntos(db, { ...origen, tabla: "INVENTARIOS" }, esquema, registros);
    const f = (async (url: string | URL | Request) =>
      String(url).endsWith("video") ? new Response("no", { status: 410 }) : new Response("ok")) as typeof fetch;
    const r = await guardarAdjuntos({ db, airtable: new AirtableFalso(), drive: new DriveFalso(), idUnidad: "u", fetch: f }, "2026-11-22", Date.now() + 60_000);
    expect(r).toEqual({ guardados: 1, fallidos: 1, pendientes: 0 });
  });

  it("el día no termina hasta guardar los adjuntos y los cuenta", async () => {
    const db = await dbDePrueba();
    const at = new AirtableFalso();
    at.esquemas.set(origen.idBase, [esquema]);
    at.poner(origen.idBase, origen.idTabla, registros[0]!.fields, "rec1");
    await prepararDia(db, "2026-11-22", [{ ...origen, workspace: "Verse", origen: "Propia", uso: "Automatizada" }]);
    const r = await procesarDia({ db, airtable: at, drive: new DriveFalso(), idUnidad: "u", fetch: descargas }, "2026-11-22", 60_000);
    expect(r).toMatchObject({ hechas: 1, adjuntosGuardados: 1, adjuntosPendientes: 0, terminado: true });
    const [dia] = await db.select().from(respaldos);
    expect(dia).toMatchObject({ adjuntos: 1, bytesAdjuntos: 10, estado: "completo" });
  });
});
