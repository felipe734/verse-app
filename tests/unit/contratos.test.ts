import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { comparar, type LecturaDocumento } from "@/lib/contratos/cedula";
import { borrador, generarContrato } from "@/lib/contratos/generar";
import { bloques, faltantes, fin, llenar, modeloDeUnidad, type DatosContrato } from "@/lib/contratos/llenar";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

vi.mock("server-only", () => ({}));
const { pdfContrato } = await import("@/lib/contratos/pdf");

const living: DatosContrato = {
  modelo: "vl-vivienda-living",
  nombre: "Felipe Armando Matías Navarro",
  tipoDoc: "CC",
  numeroDoc: "1020304050",
  lugarExpedicion: "Purificación",
  correo: "residente@prueba.co",
  whatsapp: "+57 300 000 0000",
  numero: "301",
  inicio: "2026-11-27",
  meses: 12,
  canon: 2_500_000,
  admin: 185_000,
  referenciaPago: "2301",
};

describe("generador de contratos", () => {
  it("elige el modelo por la unidad", () => {
    expect(modeloDeUnidad("VL 301_03")).toEqual({ modelo: "vl-vivienda-living", numero: "301" });
    expect(modeloDeUnidad("VL H4_04")).toEqual({ modelo: "vl-coliving", numero: "4" });
    expect(modeloDeUnidad("EB 402_01")).toEqual({ modelo: "vl-vivienda-balcony", numero: "402" });
    expect(modeloDeUnidad("Torre 603")).toBeNull();
  });

  it("llena todos los campos y deja el texto del modelo intacto", () => {
    const m = llenar(living);
    expect(m.texto).not.toMatch(/\{\{/);
    expect(m.texto).toContain("| ARRENDATARIO | Felipe Armando Matías Navarro |");
    expect(m.texto).toContain("C.C. No. 1.020.304.050 expedido en Purificación");
    expect(m.texto).toContain("doce (12) meses, del 27 de noviembre de 2026 al 27 de noviembre de 2027");
    expect(m.texto).toContain("$2.500.000 (dos millones quinientos mil pesos M/cte.)");
    expect(m.texto).toContain("$185.000 (ciento ochenta y cinco mil pesos M/cte.) mensuales");
    expect(m.texto).toContain("| Parqueadero | No aplica |");
    expect(m.meta.modelo).toBe("vl-vivienda-living");
    expect(fin(living)).toBe("2027-11-27");
  });

  it("Balcony sin parqueadero quita la fila; coliving usa duración y preaviso en letras", () => {
    const b = llenar({ ...living, modelo: "vl-vivienda-balcony", numero: "402", matricula: "50C-1", contadorEnel: "123", contratoEaab: "456" });
    expect(b.texto).not.toContain("Parqueadero |");
    const c = llenar({ ...living, modelo: "vl-coliving", numero: "4", meses: 5 });
    expect(c.texto).toContain("| Duración | cinco (5) meses, del 27 de noviembre de 2026 al 27 de abril de 2027 |");
    expect(c.texto).toContain("treinta (30) días");
  });

  it("dice qué falta antes de generar", () => {
    expect(faltantes(living)).toEqual([]);
    expect(faltantes({ ...living, lugarExpedicion: "", referenciaPago: "", meses: 0 })).toEqual(["duración en meses (1 a 60)", "lugar de expedición del documento", "referencia de pago"]);
    expect(faltantes({ ...living, modelo: "vl-vivienda-balcony" })).toEqual(["matrícula inmobiliaria", "contador de ENEL", "contrato de EAAB"]);
  });

  it("parte el modelo en bloques con tablas, grupos y firmas", () => {
    const b = bloques(llenar(living).texto);
    expect(b[0]).toEqual({ tipo: "titulo", texto: "Contrato de arrendamiento de vivienda urbana" });
    const tabla = b.find((x) => x.tipo === "tabla");
    expect(tabla && "filas" in tabla && tabla.filas[0]).toEqual({ grupo: "Las partes" });
    const firmas = b.find((x) => x.tipo === "firmas");
    expect(firmas && "filas" in firmas && firmas.filas[1]).toEqual(["C&C GROUP SAS", "Felipe Armando Matías Navarro"]);
  });

  it("arma el PDF", async () => {
    const pdf = await pdfContrato(llenar(living));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
    if (process.env.GUARDAR_PDF) {
      writeFileSync(process.env.GUARDAR_PDF, pdf);
      const b = bloques(llenar(living).texto);
      writeFileSync(process.env.GUARDAR_PDF.replace(".pdf", "-fin.pdf"), await pdfContrato(llenar(living), b.length - 5));
      const i = b.findIndex((x) => x.tipo === "seccion" && x.texto === "CLÁUSULAS");
      writeFileSync(process.env.GUARDAR_PDF.replace(".pdf", "-clausulas.pdf"), await pdfContrato(llenar(living), i));
    }
  }, 30_000);

  it("compara la lectura del documento con DATOS, sin importar el orden del nombre", () => {
    const l: LecturaDocumento = { legible: true, nombre: "MATÍAS NAVARRO FELIPE ARMANDO", numero: "1.020.304.050", fechaNacimiento: "1990-05-01", lugarExpedicion: "PURIFICACIÓN", observaciones: "" };
    expect(comparar(l, { nombre: "Felipe Armando Matías Navarro", numero: "1020304050", fechaNacimiento: "1990-05-01" }).ok).toBe(true);
    const mal = comparar({ ...l, numero: "1020304051" }, { nombre: "Felipe Armando Matías Navarro", numero: "1020304050" });
    expect(mal.ok).toBe(false);
    expect(mal.lineas.join(" ")).toContain("Número: NO coincide");
    expect(comparar({ ...l, legible: false, observaciones: "foto borrosa" }, { nombre: "x", numero: "1" }).lineas[0]).toBe("No se pudo leer el documento: foto borrosa");
  });

  it("de unidad y DATOS a CONTRATO Elaborado con PDF y validación", async () => {
    const db = await dbDePrueba();
    const at = new AirtableFalso();
    const U = ESCRITURA.unidadesContrato;
    const D = ESCRITURA.datosLiving;
    const C = ESCRITURA.contratos;
    const u = at.poner(U.idBase, U.idTabla, { [U.campos.unidad.id]: "VL 301_03", [U.campos.canon.id]: 2_500_000, [U.campos.admin.id]: 185_000, [U.campos.duracion.id]: 12, [U.campos.referenciaPago.id]: "2301" });
    const d = at.poner(D.idBase, D.idTabla, { [D.campos.nombreCompleto.id]: "Felipe Armando  Matías Navarro", [D.campos.cedula.id]: "1020304050", [D.campos.correo.id]: "residente@prueba.co", [D.campos.celular.id]: "3000000000", [D.campos.frente.id]: [{ id: "att1", url: "https://x/frente.jpg", type: "image/jpeg" }] });
    const living: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000031", correo: "alejandra@prueba.co", estado: "activo", maestro: false, nombreAirtable: "Alejandra", accesos: { verse: plantilla("living").casillas }, estructura: ESTRUCTURA };

    const b = await borrador(at, u.id, d.id);
    if ("error" in b) throw new Error(b.error);
    expect(b.datos).toMatchObject({ modelo: "vl-vivienda-living", numero: "301", nombre: "Felipe Armando Matías Navarro", canon: 2_500_000, admin: 185_000, meses: 12 });
    const datos = { ...b.datos, inicio: "2026-12-01", lugarExpedicion: "Purificación" } as DatosContrato;

    const lectura: LecturaDocumento = { legible: true, nombre: "MATIAS NAVARRO FELIPE ARMANDO", numero: "1020304050", fechaNacimiento: "", lugarExpedicion: "", observaciones: "" };
    const guardados: string[] = [];
    const deps = { leer: async () => lectura, pdf: async () => Buffer.from("%PDF-prueba"), guardar: async (_: Buffer, n: string) => (guardados.push(n), `https://blob/${n}`) };

    const malo = await generarContrato(db, at, living, { unidadRecId: u.id, datosRecId: d.id, datos: { ...datos, numeroDoc: "999" } }, deps);
    expect(malo.ok).toBe(false);
    expect(guardados).toEqual([]);

    const r = await generarContrato(db, at, living, { unidadRecId: u.id, datosRecId: d.id, datos }, deps);
    expect(r).toMatchObject({ ok: true, mensaje: "Contrato VL_301_03 elaborado" });
    const fila = [...at.tablas.get(`${C.idBase}/${C.idTabla}`)!.values()][0]!.fields;
    expect(fila).toMatchObject({
      [C.campos.contratoId.id]: "VL_301_03",
      [C.campos.estado.id]: "Elaborado",
      [C.campos.unidad.id]: [u.id],
      [C.campos.nombre.id]: [d.id],
      [C.campos.fechaInicio.id]: "2026-12-01",
      [C.campos.fechaFin.id]: "2027-12-01",
      [C.campos.mesesLetras.id]: "doce",
      [C.campos.cedulaDe.id]: "Purificación",
      [C.campos.letrasCanon.id]: "Dos millones quinientos mil pesos",
      [C.campos.contrato.id]: [{ url: "https://blob/VL_301_03.pdf", filename: "VL_301_03.pdf" }],
    });
    expect(String(fila[C.campos.validacion.id])).toContain("Nombre: coincide");

    const sinPermiso = await generarContrato(db, at, { ...living, accesos: { verse: plantilla("coordinacion-aseo").casillas } }, { unidadRecId: u.id, datosRecId: d.id, datos }, deps);
    expect(sinPermiso.mensaje).toBe("No puedes generar contratos");
  });
});
