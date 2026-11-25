import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { adjuntarSoporte } from "@/lib/cobros/soporte";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { guardarEdicion } from "@/lib/modulos/editar";
import { TABLAS_EQUIPO } from "@/lib/modulos/tablas-equipo";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const I = ESCRITURA.ingresosLiving;
const living: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000021", correo: "alejandra@prueba.co", estado: "activo", maestro: false, nombreAirtable: "Alejandra", accesos: { verse: plantilla("living").casillas }, estructura: ESTRUCTURA };
const aseo: Sesion = { ...living, accesos: { verse: plantilla("coordinacion-aseo").casillas } };

let db: Db;
let at: AirtableFalso;
const fila = (id: string) => at.tablas.get(`${I.idBase}/${I.idTabla}`)!.get(id)!.fields;

beforeEach(async () => {
  db = await dbDePrueba();
  at = new AirtableFalso();
  at.esquemas.set(I.idBase, [{ id: I.idTabla, name: "INGRESOS", fields: [{ id: I.campos.estado.id, name: "Estado", type: "singleSelect", options: { choices: [{ name: "POR PAGAR" }, { name: "PAGO" }] } }] }] as never);
});

describe("cobros de Living", () => {
  it("marcar PAGO llena Fecha pago (día de Bogotá) y Marcado por", async () => {
    const r = at.poner(I.idBase, I.idTabla, { [I.campos.estado.id]: "POR PAGAR" });
    const g = await guardarEdicion(db, at, living, "verse", "living-cobros", TABLAS_EQUIPO["cobros"]!.editar!, r.id, { estado: "PAGO" }, { [I.campos.estado.id]: "POR PAGAR" });
    expect(g.ok).toBe(true);
    expect(fila(r.id)).toMatchObject({ [I.campos.estado.id]: "PAGO", [I.campos.fechaPago.id]: hoyBogota(), [I.campos.marcadoPor.id]: "Alejandra" });
  });

  it("el soporte se suma a los que había y deja el cobro en PAGO", async () => {
    const r = at.poner(I.idBase, I.idTabla, { [I.campos.estado.id]: "POR PAGAR", [I.campos.soporte.id]: [{ id: "attViejo0000000001", url: "https://x/viejo.pdf" }] });
    expect(await adjuntarSoporte(db, at, living, r.id, { url: "https://blob/nuevo.pdf", nombre: "pse.pdf" })).toEqual({ ok: true, mensaje: "Soporte guardado y cobro en PAGO" });
    const f = fila(r.id);
    expect(f[I.campos.soporte.id]).toEqual([{ id: "attViejo0000000001" }, { url: "https://blob/nuevo.pdf", filename: "pse.pdf" }]);
    expect(f).toMatchObject({ [I.campos.estado.id]: "PAGO", [I.campos.marcadoPor.id]: "Alejandra" });
  });

  it("un cobro ya pagado solo recibe el soporte; sin permiso no", async () => {
    const r = at.poner(I.idBase, I.idTabla, { [I.campos.estado.id]: "PAGO", [I.campos.fechaPago.id]: "2026-11-02" });
    expect((await adjuntarSoporte(db, at, living, r.id, { url: "https://blob/b.png", nombre: "b.png" })).mensaje).toBe("Soporte guardado");
    expect(fila(r.id)[I.campos.fechaPago.id]).toBe("2026-11-02");
    expect((await adjuntarSoporte(db, at, aseo, r.id, { url: "https://blob/c.png", nombre: "c.png" })).mensaje).toBe("No puedes registrar pagos");
  });
});
