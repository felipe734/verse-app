import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reconciliaciones, registros, syncEstado } from "@/db/esquema";
import type { Db } from "@/db/cliente";
import { TABLAS } from "@/lib/airtable/mapeo";
import { alertasDe } from "@/lib/alertas/operacion";
import { copiaLista, filasPorFecha, reservasPorUnidad } from "@/lib/copias/leer";
import type { Sesion } from "@/lib/acceso/permisos";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { dbDePrueba } from "../apoyo/db";

const R = TABLAS.reservasHost;
const L = TABLAS.limpiezasHost;
const I = TABLAS.ingresosLivingCopia;
const U = TABLAS.unidadesOperacionCopia;

async function fila(db: Db, t: { idBase: string; idTabla: string }, recId: string, campos: Record<string, unknown>) {
  await db.insert(registros).values({ idBase: t.idBase, idTabla: t.idTabla, recId, campos, huella: recId, creadoEnAirtable: new Date() });
}

const maestro: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000010", correo: "m@prueba.co", estado: "activo", maestro: true, nombreAirtable: "Felipe", accesos: {}, estructura: ESTRUCTURA };
const sinAirtable = new Proxy({}, { get: () => () => Promise.reject(new Error("no debe llamar a Airtable")) }) as unknown as ClienteAirtable;

describe("copias en Postgres", () => {
  let db: Db;
  beforeEach(async () => {
    db = await dbDePrueba();
    process.env.LECTURA_COPIA = "1";
    await fila(db, U, "recUnidad0000001", { [U.campos.unidad.id]: "Torre 501" });
    await fila(db, U, "recUnidad0000002", { [U.campos.unidad.id]: "Parque 204" });
    // Salida el 24 sin limpieza; salida el 25 con limpieza ese día.
    await fila(db, R, "recReserva000001", { [R.campos.unidad.id]: ["recUnidad0000001"], [R.campos.ingreso.id]: "2026-11-20", [R.campos.salida.id]: "2026-11-24" });
    await fila(db, R, "recReserva000002", { [R.campos.unidad.id]: ["recUnidad0000002"], [R.campos.ingreso.id]: "2026-11-21", [R.campos.salida.id]: "2026-11-25" });
    // 15:00 UTC del 25 es el 25 en Bogotá; 03:00 UTC del 27 es el 26 en Bogotá.
    await fila(db, L, "recLimpieza00001", { [L.campos.unidad.id]: ["recUnidad0000002"], [L.campos.fecha.id]: "2026-11-25T15:00:00.000Z", [L.campos.funcionario.id]: "Edy Borrre" });
    await fila(db, L, "recLimpieza00002", { [L.campos.unidad.id]: ["recUnidad0000001"], [L.campos.fecha.id]: "2026-11-27T03:00:00.000Z" });
    await fila(db, I, "recIngreso000001", { [I.campos.unidad.id]: "VL 302", [I.campos.fecha.id]: "2026-11-05", [I.campos.estado.id]: "POR PAGAR" });
    await fila(db, I, "recIngreso000002", { [I.campos.unidad.id]: "VL 303", [I.campos.fecha.id]: "2026-11-05", [I.campos.estado.id]: "PAGO" });
  });
  afterEach(() => {
    delete process.env.LECTURA_COPIA;
  });

  it("lee el día en hora de Bogotá", async () => {
    const f = await filasPorFecha(db, "limpiezasHost", "fecha", { desde: "2026-11-26", hasta: "2026-11-27" });
    expect(f.map((x) => [x.recId, x.dia])).toEqual([["recLimpieza00002", "2026-11-26"]]);
  });

  it("solo se usa si cuadró tres noches y el webhook está vigente", async () => {
    expect(await copiaLista(db, ["reservasHost"])).toBe(false);
    for (let i = 0; i < 3; i++) await db.insert(reconciliaciones).values({ clave: "reservasHost", filasAirtable: 2, filasCopia: 2, faltaban: 0, sobraban: 0, distintas: 0, cuadra: true });
    expect(await copiaLista(db, ["reservasHost"])).toBe(false);
    await db.insert(syncEstado).values({ clave: "reservasHost", idBase: R.idBase, idTabla: R.idTabla, webhookId: "ach1", webhookVence: new Date(Date.now() + 86_400_000) });
    expect(await copiaLista(db, ["reservasHost"])).toBe(true);
    delete process.env.LECTURA_COPIA;
    expect(await copiaLista(db, ["reservasHost"])).toBe(false);
  });

  it("calcula las alertas desde la copia sin llamar a Airtable", async () => {
    const a = await alertasDe({ airtable: sinAirtable, s: maestro, estructura: ESTRUCTURA, hoy: "2026-11-23", db, copia: true });
    const porId = Object.fromEntries(a.map((x) => [x.id, x]));
    expect(porId["reservas-sin-limpieza"]?.detalle).toBe("En los próximos 3 días: Torre 501 (24)");
    expect(porId["limpiezas-sin-funcionaria"]?.detalle).toBe("Torre 501");
    expect(porId["cobros-vencidos-5d"]?.detalle).toBe("VL 302");
  });

  it("busca reservas por nombre de unidad", async () => {
    const r = await reservasPorUnidad(db, "torre", "2026-11-23", "2026-12-01");
    expect(r).toEqual([{ recId: "recReserva000001", unidad: "Torre 501", ingreso: "20/11/2026", salida: "24/11/2026" }]);
  });
});
