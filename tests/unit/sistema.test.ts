import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { reconciliaciones, respaldos, syncEstado, tareas } from "@/db/esquema";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { contarNoches, sistemaDe } from "@/lib/sistema/datos";
import { dbDePrueba } from "../apoyo/db";

const AHORA = new Date("2026-11-25T15:00:00Z");
const CLAVES = ["trazabilidadVerse", "trazabilidadCyC", "unidadesHost", "unidadesLiving"];
const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "u",
  correo: "p@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Diana",
  accesos,
  ...extra,
});
const maestro = sesion({}, { maestro: true });

describe("noches seguidas", () => {
  it("cuenta hasta hoy si ya corrió, o hasta anoche si no", () => {
    const m = new Map([
      ["2026-11-22", false],
      ["2026-11-23", true],
      ["2026-11-24", true],
    ]);
    expect(contarNoches(m, "2026-11-25")).toBe(2);
    m.set("2026-11-25", true);
    expect(contarNoches(m, "2026-11-25")).toBe(3);
    m.set("2026-11-25", false);
    expect(contarNoches(m, "2026-11-25")).toBe(0);
  });
});

describe("Sistema", () => {
  let db: Db;
  beforeEach(async () => {
    db = await dbDePrueba();
    const noche = (dia: string, cuadra: boolean) =>
      CLAVES.map((clave) => ({ clave, cuando: new Date(`${dia}T07:05:00Z`), filasAirtable: 1, filasCopia: 1, faltaban: 0, sobraban: 0, distintas: cuadra ? 0 : 1, cuadra }));
    await db.insert(reconciliaciones).values([...noche("2026-11-23", true), ...noche("2026-11-24", true), ...noche("2026-11-25", true)]);
    await db.insert(syncEstado).values({ clave: "trazabilidadVerse", idBase: "a", idTabla: "t", filas: 352, error: "Airtable respondió 500" });
    await db.insert(respaldos).values([
      { fecha: "2026-11-24", estado: "completo", tablas: 107, hechas: 107 },
      { fecha: "2026-11-23", estado: "en_curso", tablas: 107, hechas: 40 },
    ]);
    await db.insert(tareas).values([
      { recId: "recCORRIDA0000001", empresa: "Verse", tipo: "Corrida", asunto: "Liquidaciones creadas", estado: "OK", proceso: "Cierre A", creado: new Date("2026-11-24T12:00:00Z") },
      { recId: "recCORRIDA0000002", empresa: "Verse", tipo: "Corrida", asunto: "Programación no salió", estado: "Falló", proceso: "Limpiezas", creado: new Date("2026-11-25T12:00:00Z") },
      { recId: "recCORRIDA0000003", empresa: "C&C", tipo: "Corrida", asunto: "Actas cargadas", estado: "OK", proceso: "Actas obra", creado: new Date("2026-11-25T12:00:00Z") },
      { recId: "recVIEJA00000001", empresa: "Verse", tipo: "Corrida", asunto: "Vieja", estado: "OK", proceso: "Brief", creado: new Date("2026-11-01T12:00:00Z") },
    ]);
  });

  it("el Maestro ve corridas, fallas, sincronización, respaldo y las 3 noches de la entrega 0", async () => {
    const s = (await sistemaDe(db, maestro, "verse", AHORA))!;
    expect(s.corridas.map((c) => c.asunto)).toEqual(["Programación no salió", "Liquidaciones creadas"]);
    expect(s.fallas.map((f) => f.tipo)).toEqual(["Corrida falló", "Sincronización", "Respaldo"]);
    expect(s.app?.nochesSeguidas).toBe(3);
    expect(s.app?.tablas.find((t) => t.clave === "trazabilidadVerse")).toMatchObject({ filas: 352, noches: [true, true, true] });
    expect(s.app?.asistente).toEqual({ respuestas: 0, preguntas: 0, costoUsd: 0, porPregunta: 0 });
  });

  it("Sistema de C&C solo trae lo de C&C y nada de la app", async () => {
    const s = (await sistemaDe(db, maestro, "cyc", AHORA))!;
    expect(s.corridas.map((c) => c.asunto)).toEqual(["Actas cargadas"]);
    expect(s.app).toBeNull();
  });

  it("sin el módulo Sistema no devuelve nada", async () => {
    expect(await sistemaDe(db, sesion({ verse: plantilla("living").casillas }), "verse", AHORA)).toBeNull();
    expect(await sistemaDe(db, sesion({ verse: plantilla("administrador-verse").casillas }), "cyc", AHORA)).toBeNull();
    expect(await sistemaDe(db, sesion({ verse: plantilla("administrador-verse").casillas }), "verse", AHORA)).not.toBeNull();
  });
});
