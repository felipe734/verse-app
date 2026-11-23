import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { ejecutar } from "@/lib/asistente/herramientas";
import { modeloPara, MODELO_POR_DEFECTO, MODELO_PROFUNDO } from "@/lib/asistente/precios";
import { buscarReservas, verCierre } from "@/lib/asistente/vivo";
import { AirtableFalso } from "../apoyo/airtable-falso";

// Datos inventados. Ids de 6. OPERACION 360 / RESERVAS y 2. FACTURACION / AGREGADO (catálogo).
const RES = { base: "appOJopQhmyaON16G", tabla: "tblVrwSgN0doLGXuq" };
const AGR = { base: "appferuxfJHgGzJsH", tabla: "tblCJ24S1ConrqMXV" };
const HOY = "2026-11-25";

const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "00000000-0000-0000-0000-000000000002",
  correo: "p@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Prueba",
  accesos,
  ...extra,
});

const maestro = sesion({}, { maestro: true });
const conAsistente = (id: string, nivel: "consultas" | "acciones" = "consultas") => sesion({ verse: { ...plantilla(id).casillas, asistente: nivel } });

let at: AirtableFalso;
beforeEach(() => {
  at = new AirtableFalso();
  at.poner(RES.base, RES.tabla, {
    "ID Reserva": "R-1",
    Unidad: "Teik 603",
    Edificio: "Teik",
    Ingreso: "2026-11-26",
    Salida: "2026-11-29",
    Nombre: "Huésped Prueba",
    "Celular H1": "3000000000",
    TOT: "$900.000",
    Código: "1234",
    "Pass WIFI": "clave",
  });
  at.poner(AGR.base, AGR.tabla, { Fecha: "1/10/2026", "Total Facturado": "$100", Margen: "10%" });
  at.poner(AGR.base, AGR.tabla, { Fecha: "1/11/2026", "Total Facturado": "$120", Margen: "12%" });
});

describe("buscar reservas", () => {
  it("el Maestro ve todo y la fórmula cruza el rango", async () => {
    const r = await buscarReservas(at, maestro, {}, HOY);
    expect(r).toMatchObject({ desde: HOY, hasta: "2026-12-02", total: 1, ocultos: [] });
    expect("reservas" in r && r.reservas?.[0]).toMatchObject({ Nombre: "Huésped Prueba", TOT: "$900.000", Código: "1234" });
    const f = at.consultas[0]!.formula!;
    expect(f).toContain("IS_BEFORE({Ingreso}, DATEADD(DATETIME_PARSE('2026-11-25'), 8, 'days'))");
    expect(f).toContain("IS_AFTER({Salida}, DATEADD(DATETIME_PARSE('2026-11-25'), -1, 'days'))");
  });

  it("coordinación de aseo no recibe montos ni datos del huésped; sí códigos", async () => {
    const r = await buscarReservas(at, conAsistente("coordinacion-aseo"), {}, HOY);
    expect(at.consultas[0]!.campos).not.toContain("TOT");
    expect(at.consultas[0]!.campos).not.toContain("Nombre");
    expect(at.consultas[0]!.campos).toContain("Código");
    expect(r).toMatchObject({ ocultos: ["datos del huésped", "montos"] });
    expect("reservas" in r && r.reservas?.[0]).not.toHaveProperty("TOT");
  });

  it("los códigos 'solo en su turno' no salen por el asistente", async () => {
    const aseo = sesion({ verse: { ...plantilla("aseo").casillas, modulos: { "host-operacion": "ver" }, asistente: "consultas" } });
    await buscarReservas(at, aseo, {}, HOY);
    expect(at.consultas[0]!.campos).not.toContain("Código");
  });

  it("sin la operación de Host no consulta Airtable", async () => {
    const r = await buscarReservas(at, conAsistente("living"), {}, HOY);
    expect(r).toEqual({ error: "Sin acceso a la operación de Verse Host." });
    expect(at.consultas).toHaveLength(0);
  });

  it("filtra por unidad sin dejar pasar comillas a la fórmula", async () => {
    await buscarReservas(at, maestro, { unidad: "Teik' 603\"" }, HOY);
    expect(at.consultas[0]!.formula).toContain("FIND('teik 603', LOWER(ARRAYJOIN({Unidad})))");
  });

  it("rechaza un rango al revés", async () => {
    expect(await buscarReservas(at, maestro, { desde: "2026-11-30", hasta: "2026-11-01" }, HOY)).toEqual({ error: "La fecha final es anterior a la inicial." });
  });
});

describe("ver cierre", () => {
  it("devuelve el mes y el anterior", async () => {
    const r = await verCierre(at, maestro, { mes: "2026-11" });
    expect(r).toMatchObject({ mes: "2026-11", cierre: { Margen: "12%" }, mes_anterior: { Margen: "10%" } });
  });

  it("un mes sin cierre dice cuáles hay", async () => {
    const r = await verCierre(at, maestro, { mes: "2026-12" });
    expect(r).toMatchObject({ meses_disponibles: ["2026-10", "2026-11"] });
  });

  it("sin cifras no hay cierre", async () => {
    const r = await verCierre(at, conAsistente("coordinacion-aseo"), { mes: "2026-11" });
    expect(r).toHaveProperty("error");
    expect(at.consultas).toHaveLength(0);
  });
});

describe("herramientas en vivo dentro del asistente", () => {
  const ctx = (s: Sesion, conAirtable = true) => ({ db: {} as Db, sesion: s, conversacionId: null, hoy: HOY, airtable: conAirtable ? at : undefined });

  it("sin cliente de Airtable responde con error, sin romper", async () => {
    const r = await ejecutar("ver_cierre", { mes: "2026-11" }, ctx(maestro, false));
    expect(r.error).toBe(true);
  });

  it("valida la entrada", async () => {
    const r = await ejecutar("ver_cierre", { mes: "noviembre" }, ctx(maestro));
    expect(r.error).toBe(true);
    expect(at.consultas).toHaveLength(0);
  });

  it("sin asistente en Verse no lee reservas", async () => {
    const r = await ejecutar("buscar_reservas", {}, ctx(sesion({ verse: plantilla("coordinacion-aseo").casillas })));
    expect(r.error).toBe(true);
  });

  it("buscar reservas llega a Airtable", async () => {
    const r = await ejecutar("buscar_reservas", {}, ctx(maestro));
    expect(JSON.parse(r.contenido).total).toBe(1);
  });
});

describe("modelo", () => {
  it("cierres y diagnósticos con Opus, lo demás con Sonnet", () => {
    expect(modeloPara("¿Cómo quedó el cierre de octubre?")).toBe(MODELO_PROFUNDO);
    expect(modeloPara("dame un diagnóstico del margen")).toBe(MODELO_PROFUNDO);
    expect(modeloPara("qué reservas entran mañana")).toBe(MODELO_POR_DEFECTO);
  });
});
