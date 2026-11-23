import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { tareas } from "@/db/esquema";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { MARCA_APROBADO } from "@/lib/hoy/acciones";
import { aprobacionesDe, veAprobar } from "@/lib/hoy/aprobar";
import { dbDePrueba } from "../apoyo/db";

const fila = (recId: string, p: Partial<typeof tareas.$inferInsert>) => ({
  recId,
  empresa: "Verse" as const,
  tipo: "Pendiente",
  estado: "Abierto",
  responsable: "Felipe",
  fechaLimite: "2026-11-25",
  ...p,
});

const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "u",
  correo: "p@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Diana",
  accesos,
  ...extra,
});

describe("Para aprobar", () => {
  let db: Db;
  beforeEach(async () => {
    db = await dbDePrueba();
    await db.insert(tareas).values([
      fila("recAPROBAR0000001", { asunto: "Cruce", detalle: "Aprobar: CRUCES de 10 a 12\npor qué" }),
      fila("recAPROBADA000001", { asunto: "Objetivo", detalle: `Aprobar: OBJETIVO a Cumplido\n${MARCA_APROBADO} por f@p.co el 2026-11-24` }),
      fila("recNORMAL00000001", { asunto: "Normal", detalle: "Revisar algo" }),
      fila("recCERRADA0000001", { asunto: "Vieja", detalle: "Aprobar: algo", estado: "Hecho" }),
      fila("recCYC00000000001", { asunto: "Obra", empresa: "C&C", detalle: "Aprobar: pago a contratista" }),
    ]);
  });

  it("el Maestro ve las abiertas de las dos empresas, con el cambio sin la etiqueta", async () => {
    const l = await aprobacionesDe(db, sesion({}, { maestro: true }), ["verse", "cyc"]);
    expect(l.map((a) => [a.asunto, a.cambio, a.puedeResponder])).toEqual([
      ["Cruce", "CRUCES de 10 a 12", true],
      ["Obra", "pago a contratista", true],
      ["Objetivo", "OBJETIVO a Cumplido", false],
    ]);
  });

  it("sin la casilla ni el módulo no ve nada; sin C&C no ve las de C&C", async () => {
    const aseo = sesion({ verse: plantilla("aseo").casillas });
    expect(veAprobar(aseo, "verse")).toBe(false);
    expect(await aprobacionesDe(db, aseo, ["verse", "cyc"])).toEqual([]);
  });

  it("con el módulo en ver pero sin la casilla Aprobar ve las filas y no puede responder", async () => {
    const c = plantilla("administrador-verse").casillas;
    const s = sesion({ verse: { ...c, modulos: { ...c.modulos, "verse-aprobar": "ver" } } });
    const l = await aprobacionesDe(db, s, ["verse", "cyc"]);
    expect(l.map((a) => a.asunto)).toEqual(["Cruce", "Objetivo"]);
    expect(l.every((a) => !a.puedeResponder)).toBe(true);
  });
});
