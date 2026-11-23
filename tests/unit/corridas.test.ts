import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditoria, respaldoAdjuntos } from "@/db/esquema";
import type { Db } from "@/db/cliente";
import { TABLAS } from "@/lib/airtable/mapeo";
import { PROCESO_RESPALDO, registrarCorrida, type Corrida } from "@/lib/corridas";
import { campoNuevo, filaRestaurada, restaurar } from "@/lib/respaldo/restaurar";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";
import { DriveFalso } from "../apoyo/drive-falso";

const TV = TABLAS.trazabilidadVerse;
const k = TV.campos;

const corrida: Corrida = {
  proceso: "Respaldo",
  asunto: "Respaldo Airtable 2026-11-23",
  estado: "OK",
  detalle: "Tablas: 107 de 107",
  link: "https://drive.google.com/drive/folders/prueba",
  mes: "2026-11",
  pendiente: { asunto: "Revisar respaldo de Airtable del 2026-11-23", fechaLimite: "2026-11-23" },
};

function airtableConProcesos(opciones: string[]) {
  const at = new AirtableFalso();
  at.esquemas.set(TV.idBase, [
    { id: TV.idTabla, name: "TRAZABILIDAD VERSE", fields: [{ id: k.proceso.id, name: "Proceso", type: "singleSelect", options: { choices: opciones.map((name) => ({ name })) } }] },
  ]);
  return at;
}

const filas = (at: AirtableFalso) => [...(at.tablas.get(`${TV.idBase}/${TV.idTabla}`)?.values() ?? [])].map((r) => r.fields);

describe("Corridas en TRAZABILIDAD VERSE", () => {
  let db: Db;
  beforeEach(async () => {
    db = await dbDePrueba();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("apagadas no escriben nada en Airtable", async () => {
    const at = airtableConProcesos(["Respaldo"]);
    expect(await registrarCorrida(db, at, corrida)).toBeNull();
    expect(filas(at)).toEqual([]);
  });

  it("encendidas dejan la Corrida por la cola, con auditoría", async () => {
    vi.stubEnv("CORRIDAS_ACTIVAS", "1");
    const at = airtableConProcesos(["Verse OS", "Respaldo"]);
    const r = await registrarCorrida(db, at, corrida);
    expect(r?.corrida).toMatch(/^rec/);
    expect(r?.pendiente).toBeUndefined();
    expect(filas(at)).toEqual([
      expect.objectContaining({ [k.tipo.id]: "Corrida", [k.proceso.id]: "Respaldo", [k.estado.id]: "OK", [k.responsable.id]: "Felipe", [k.linea.id]: "Grupo", [k.mes.id]: "2026-11" }),
    ]);
    const [a] = await db.select().from(auditoria);
    expect(a).toMatchObject({ autor: "app@verse", accion: "escritura.crear" });
  });

  it("si la opción de Proceso no existe usa Verse OS, sin tocar el esquema", async () => {
    vi.stubEnv("CORRIDAS_ACTIVAS", "1");
    const at = airtableConProcesos(["Verse OS"]);
    await registrarCorrida(db, at, corrida);
    expect(filas(at)[0]?.[k.proceso.id]).toBe(PROCESO_RESPALDO);
  });

  it("si algo falló deja también un Pendiente enlazado a la Corrida", async () => {
    vi.stubEnv("CORRIDAS_ACTIVAS", "1");
    const at = airtableConProcesos(["Verse OS"]);
    const r = await registrarCorrida(db, at, { ...corrida, estado: "Con pendientes" });
    const pendiente = filas(at).find((f) => f[k.tipo.id] === "Pendiente");
    expect(pendiente).toMatchObject({ [k.estado.id]: "Abierto", [k.responsable.id]: "Felipe", [k.fechaLimite.id]: "2026-11-23", [k.corrida.id]: [r!.corrida] });
  });
});

describe("restauración", () => {
  const esquema = {
    id: "tblORIGEN00000000",
    name: "C0. LEAD GEN",
    primaryFieldId: "fldActividad",
    fields: [
      { id: "fldActividad", name: "Actividad", type: "singleLineText" },
      { id: "fldEstado", name: "Estado", type: "singleSelect", options: { choices: [{ id: "sel1", name: "Hecho" }] } },
      { id: "fldNumero", name: "Valor", type: "currency", options: { precision: 0, symbol: "$" } },
      { id: "fldVinculo", name: "Lead", type: "multipleRecordLinks", options: { linkedTableId: "tblX" } },
      { id: "fldArchivo", name: "Foto", type: "multipleAttachments" },
    ],
  };

  it("conserva los tipos simples y deja el resto como texto largo", () => {
    expect(campoNuevo(esquema.fields[0]!, true)).toEqual({ name: "Actividad", type: "singleLineText" });
    expect(campoNuevo(esquema.fields[1]!, false)).toEqual({ name: "Estado", type: "singleSelect", options: { choices: [{ name: "Hecho" }] } });
    expect(campoNuevo(esquema.fields[2]!, false)).toEqual({ name: "Valor", type: "currency", options: { precision: 0, symbol: "$" } });
    expect(campoNuevo(esquema.fields[3]!, false)).toEqual({ name: "Lead", type: "multilineText" });
  });

  it("pasa los valores por nombre de campo y apunta los adjuntos a Drive", () => {
    const fila = filaRestaurada(
      {
        id: "rec1",
        createdTime: "",
        fields: { fldActividad: "Llamar", fldEstado: "Hecho", fldNumero: 1000, fldVinculo: ["recLEAD000000001"], fldArchivo: [{ id: "attA", filename: "foto.jpg", url: "x" }] },
      },
      esquema,
      new Map([["attA", "https://drive.google.com/file/d/archivoA"]]),
    );
    expect(fila).toEqual({
      Actividad: "Llamar",
      Estado: "Hecho",
      Valor: 1000,
      Lead: "recLEAD000000001",
      Foto: "foto.jpg · https://drive.google.com/file/d/archivoA",
    });
  });

  it("crea una tabla RESTAURADA nueva con todas las filas y no toca la original", async () => {
    const db = await dbDePrueba();
    const drive = new DriveFalso();
    const dia = await drive.carpeta("2026-11-22", "u");
    const base = await drive.carpeta("9. VERSE OS", dia);
    const registros = [
      { id: "rec1", createdTime: "", fields: { fldActividad: "Uno", fldArchivo: [{ id: "attA", filename: "a.jpg" }] } },
      { id: "rec2", createdTime: "", fields: { fldActividad: "Dos" } },
    ];
    await drive.subir("C0. LEAD GEN.json", base, JSON.stringify({ idBase: TV.idBase, esquema, registros }), "application/json");
    await db.insert(respaldoAdjuntos).values({
      idAdjunto: "attA",
      idBase: TV.idBase,
      idTabla: esquema.id,
      base: "9. VERSE OS",
      tabla: "C0. LEAD GEN",
      recId: "rec1",
      idCampo: "fldArchivo",
      nombre: "a.jpg",
      url: "x",
      estado: "guardado",
      idDrive: "archivoA",
    });

    const at = new AirtableFalso();
    const r = await restaurar({ db, airtable: at, drive, idUnidad: "u" }, { fecha: "2026-11-22", base: "9. VERSE OS", tabla: "C0. LEAD GEN", idBase: TV.idBase });
    expect(r).toMatchObject({ tabla: "RESTAURADA 2026-11-22 · C0. LEAD GEN", filas: 2 });
    expect(at.tablasCreadas[0]?.campos[0]).toEqual({ name: "Actividad", type: "singleLineText" });
    const restauradas = [...at.tablas.get(`${TV.idBase}/${r.idTabla}`)!.values()].map((x) => x.fields);
    expect(restauradas[0]).toEqual({ Actividad: "Uno", Foto: "a.jpg · https://drive.google.com/file/d/archivoA" });
    expect(at.tablas.has(`${TV.idBase}/${esquema.id}`)).toBe(false);
  });

  it("avisa claro si no hay respaldo de esa fecha", async () => {
    await expect(
      restaurar({ db: await dbDePrueba(), airtable: new AirtableFalso(), drive: new DriveFalso(), idUnidad: "u" }, { fecha: "2026-01-01", base: "b", tabla: "t", idBase: "appX" }),
    ).rejects.toThrow("No hay respaldo del 2026-01-01");
  });
});
