import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { auditoria } from "@/db/esquema";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { camposEditables, formularioEdicion, guardarEdicion, olvidarEsquemas } from "@/lib/modulos/editar";
import { PESTANAS } from "@/lib/modulos/finanzas";
import { TABLAS_EQUIPO } from "@/lib/modulos/tablas-equipo";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const L = ESCRITURA.limpieza;
const def = TABLAS_EQUIPO.limpiezas!.editar!;
let db: Db;
let at: AirtableFalso;
let fila: string;

const sesion = (casillas: Sesion["accesos"][string]): Sesion => ({
  usuarioId: "00000000-0000-0000-0000-000000000008",
  correo: "coord@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Prueba",
  accesos: { verse: casillas },
  estructura: ESTRUCTURA,
});
const coord = sesion(plantilla("coordinacion-aseo").casillas);
const living = sesion(plantilla("living").casillas);

beforeEach(async () => {
  olvidarEsquemas();
  db = await dbDePrueba();
  at = new AirtableFalso();
  at.esquemas.set(L.idBase, [
    { id: L.idTabla, name: "LIMPIEZA", fields: [{ id: L.campos.estado.id, name: "Estado", type: "singleSelect", options: { choices: [{ name: "Programado" }, { name: "Terminado" }] } } as never] },
  ]);
  fila = at.poner(L.idBase, L.idTabla, { [L.campos.estado.id]: "Programado", [L.campos.comentario.id]: "Salida" }).id;
});

describe("editar desde los módulos", () => {
  it("todo campo ofrecido existe en el mapeo y es de un tipo editable", () => {
    for (const d of [...Object.values(TABLAS_EQUIPO), ...Object.values(PESTANAS).flat().map((p) => p.tabla)])
      if (d.editar) expect(camposEditables(d.editar), d.editar.tabla).toEqual(d.editar.campos.map((c) => c.campo));
  });

  it("el formulario trae los valores y las opciones del esquema vivo", async () => {
    const f = await formularioEdicion(at, coord, "verse", "host-limpiezas", def, fila);
    expect(f).toMatchObject({
      campos: [
        { campo: "estado", tipo: "opciones", valor: "Programado", opciones: ["Programado", "Terminado"] },
        { campo: "comentario", tipo: "texto", valor: "Salida" },
      ],
    });
  });

  it("sin el módulo en editar no se abre ni se guarda", async () => {
    expect(await formularioEdicion(at, living, "verse", "host-limpiezas", def, fila)).toEqual({ error: "No puedes editar en este módulo" });
    expect((await guardarEdicion(db, at, living, "verse", "host-limpiezas", def, fila, { estado: "Terminado" }, {})).ok).toBe(false);
  });

  it("guarda por la cola con lo que se vio y queda en AUDITORIA", async () => {
    const f = (await formularioEdicion(at, coord, "verse", "host-limpiezas", def, fila)) as { antes: Record<string, unknown> };
    const r = await guardarEdicion(db, at, coord, "verse", "host-limpiezas", def, fila, { estado: "Terminado", comentario: "  Listo  " }, f.antes);
    expect(r).toEqual({ ok: true, mensaje: "Guardado en Airtable" });
    const actual = await at.obtener(L.idBase, L.idTabla, fila);
    expect(actual?.fields).toMatchObject({ [L.campos.estado.id]: "Terminado", [L.campos.comentario.id]: "Listo" });
    const [a] = await db.select().from(auditoria);
    expect(a).toMatchObject({ accion: "escritura.actualizar", autor: "coord@prueba.co" });
  });

  it("una opción que no existe o un campo fuera de la lista no pasan", async () => {
    expect((await guardarEdicion(db, at, coord, "verse", "host-limpiezas", def, fila, { estado: "Inventado" }, {})).mensaje).toContain("no es una opción");
    expect((await guardarEdicion(db, at, coord, "verse", "host-limpiezas", def, fila, { fecha: "2026-11-25" }, {})).mensaje).toContain('No se puede editar "fecha"');
  });

  it("si la fila cambió en Airtable mientras editaba, gana Airtable", async () => {
    const f = (await formularioEdicion(at, coord, "verse", "host-limpiezas", def, fila)) as { antes: Record<string, unknown> };
    await at.actualizar(L.idBase, L.idTabla, fila, { [L.campos.estado.id]: "Terminado" });
    const r = await guardarEdicion(db, at, coord, "verse", "host-limpiezas", def, fila, { estado: "Programado" }, f.antes);
    expect(r.mensaje).toContain("cambió en Airtable");
    expect((await at.obtener(L.idBase, L.idTabla, fila))?.fields[L.campos.estado.id]).toBe("Terminado");
  });
});
