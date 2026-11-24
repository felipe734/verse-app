import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { cerrarOlvidado, hMin, horasTurno, programadoDe, semanaHoras, validarSemana } from "@/lib/horas/semana";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const H = ESCRITURA.controlHoras;
const LUNES = "2026-11-23";
const HOY = "2026-11-26";
const maestro: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000010", correo: "m@prueba.co", estado: "activo", maestro: true, nombreAirtable: "Felipe", accesos: {}, estructura: ESTRUCTURA };
const aseo: Sesion = { ...maestro, maestro: false, accesos: { verse: plantilla("aseo").casillas } };

let db: Db;
let at: AirtableFalso;
const turno = (f: Record<string, unknown>) => at.poner(H.idBase, H.idTabla, { "Funcionaria enlace": "Edy Borré", Funcionaria: "Edy", Validado: "", ...f });

beforeEach(async () => {
  db = await dbDePrueba();
  at = new AirtableFalso();
});

describe("control de horas", () => {
  it("reglas: almuerzo después de 5 h, programado y festivos", () => {
    expect(horasTurno("8:30 a. m.", "5:00 p. m.")).toBe(7.5);
    expect(horasTurno("8:30 a. m.", "1:00 p. m.")).toBe(4.5);
    expect(programadoDe("2026-11-23")).toBe(7.5);
    expect(programadoDe("2026-11-28")).toBe(4.5);
    expect(programadoDe("2026-11-29")).toBe(0);
    expect(programadoDe("2026-11-16")).toBe(0);
    expect(hMin(-1.5)).toBe("1 h 30 min");
  });

  it("suma la semana contra 42 h y marca el turno olvidado de un día pasado", async () => {
    turno({ Ingreso: "23/11/2026 8:30am", Salida: "23/11/2026 5:00pm", Validado: "checked" });
    turno({ Ingreso: "24/11/2026 8:30am", Salida: "24/11/2026 4:00pm" });
    turno({ Ingreso: "25/11/2026 8:30am", Salida: "" });
    turno({ Ingreso: "26/11/2026 8:30am", Salida: "" });
    const [s] = await semanaHoras(at, LUNES, HOY);
    expect(s).toMatchObject({ nombre: "Edy Borré", meta: 42, real: 14, diferencia: -28, validada: false });
    expect(s!.abiertos.map((t) => t.fecha)).toEqual(["2026-11-25"]);
  });

  it("cierra un turno olvidado el mismo día, con nota; no si ya tiene salida ni sin permiso", async () => {
    const t = at.poner(H.idBase, H.idTabla, { [H.campos.ingreso.id]: "2026-11-25T13:30:00.000Z", [H.campos.notas.id]: "Turno desde Verse App" }).id;
    expect((await cerrarOlvidado(db, at, aseo, t, "17:00")).mensaje).toBe("No puedes corregir turnos");
    expect((await cerrarOlvidado(db, at, maestro, t, "07:00")).mensaje).toBe("La salida tiene que ser después del ingreso");
    expect(await cerrarOlvidado(db, at, maestro, t, "17:00")).toEqual({ ok: true, mensaje: "Turno cerrado" });
    const f = [...at.tablas.get(`${H.idBase}/${H.idTabla}`)!.values()].find((x) => x.id === t)!.fields;
    expect(f[H.campos.salida.id]).toBe("2026-11-25T22:00:00.000Z");
    expect(f[H.campos.notas.id]).toBe("Turno desde Verse App\nSalida corregida por Felipe desde Verse App");
    expect((await cerrarOlvidado(db, at, maestro, t, "18:00")).mensaje).toBe("Ese turno ya tiene salida");
  });

  it("valida la semana solo sin turnos abiertos", async () => {
    turno({ Ingreso: "23/11/2026 8:30am", Salida: "23/11/2026 5:00pm" });
    const abierto = turno({ Ingreso: "24/11/2026 8:30am", Salida: "" });
    expect((await validarSemana(db, at, maestro, "Edy Borré", LUNES, HOY)).mensaje).toBe("Hay turnos sin salida: ciérralos antes de validar");
    abierto.fields.Salida = "24/11/2026 5:00pm";
    at.tablas.get(`${H.idBase}/${H.idTabla}`)!.set(abierto.id, abierto);
    expect(await validarSemana(db, at, maestro, "Edy Borré", LUNES, HOY)).toEqual({ ok: true, mensaje: "Semana de Edy Borré validada (2 turnos)" });
    const vals = [...at.tablas.get(`${H.idBase}/${H.idTabla}`)!.values()].map((x) => x.fields[H.campos.validado.id]);
    expect(vals).toEqual([true, true]);
  });
});
