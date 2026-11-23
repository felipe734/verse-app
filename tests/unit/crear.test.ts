import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { auditoria } from "@/db/esquema";
import { ESCRITURA } from "@/lib/airtable/mapeo";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { camposCreables, crearFila, formularioCreacion, olvidarOpciones } from "@/lib/modulos/crear";
import { PESTANAS } from "@/lib/modulos/finanzas";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const C = ESCRITURA.cajaVerse;
const def = PESTANAS.finanzas.find((p) => p.id === "caja")!.crear!;
let db: Db;
let at: AirtableFalso;

const maestro: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000009", correo: "m@prueba.co", estado: "activo", maestro: true, nombreAirtable: "Felipe", accesos: {}, estructura: ESTRUCTURA };
const admin: Sesion = { ...maestro, maestro: false, correo: "a@prueba.co", accesos: { verse: plantilla("administrador-verse").casillas } };

beforeEach(async () => {
  olvidarOpciones();
  db = await dbDePrueba();
  at = new AirtableFalso();
  at.esquemas.set(C.idBase, [{ id: C.idTabla, name: "CAJA MENOR VERSE", fields: [{ id: C.campos.persona.id, name: "Persona", type: "singleSelect", options: { choices: [{ name: "Diana" }, { name: "Edy" }] } } as never] }]);
});

const filas = () => [...(at.tablas.get(`${C.idBase}/${C.idTabla}`)?.values() ?? [])];
const base = { concepto: "Bolsas de basura", valor: "45.000", fecha: "2026-11-25", persona: "Edy", apto: "603" };

describe("crear gastos de caja menor", () => {
  it("toda pestaña que crea tiene sus campos en el mapeo con un tipo que se puede escribir", () => {
    for (const p of Object.values(PESTANAS).flat()) if (p.crear) expect(camposCreables(p.crear), p.id).toEqual(p.crear.campos.map((c) => c.campo));
  });

  it("el formulario trae las opciones y la fecha de hoy", async () => {
    const f = await formularioCreacion(at, maestro, "verse", "verse-finanzas", def, "2026-11-25");
    expect(f).toMatchObject({ campos: expect.arrayContaining([expect.objectContaining({ campo: "persona", opciones: ["Diana", "Edy"] }), expect.objectContaining({ campo: "fecha", defecto: "2026-11-25" })]) });
  });

  it("con Finanzas solo en ver no se crea", async () => {
    expect(await formularioCreacion(at, admin, "verse", "verse-finanzas", def, "2026-11-25")).toEqual({ error: "No puedes crear en este módulo" });
    expect((await crearFila(db, at, admin, "verse", "verse-finanzas", def, base)).ok).toBe(false);
  });

  it("crea por la cola con el monto como número y el soporte del almacenamiento de la app", async () => {
    const r = await crearFila(db, at, maestro, "verse", "verse-finanzas", def, { ...base, foto: { url: "https://x.public.blob.vercel-storage.com/s.jpg", nombre: "s.jpg" } });
    expect(r).toEqual({ ok: true, mensaje: "Guardado en Airtable" });
    expect(filas()[0]?.fields).toMatchObject({ [C.campos.valor.id]: 45000, [C.campos.persona.id]: "Edy", [C.campos.fecha.id]: "2026-11-25", [C.campos.foto.id]: [{ url: "https://x.public.blob.vercel-storage.com/s.jpg", filename: "s.jpg" }] });
    expect((await db.select().from(auditoria))[0]?.accion).toBe("escritura.crear");
  });

  it("falta un obligatorio, opción inventada, monto raro o soporte ajeno: no se crea", async () => {
    expect((await crearFila(db, at, maestro, "verse", "verse-finanzas", def, { ...base, concepto: " " })).mensaje).toBe("Falta concepto");
    expect((await crearFila(db, at, maestro, "verse", "verse-finanzas", def, { ...base, persona: "Nadie" })).mensaje).toContain("no es una opción");
    expect((await crearFila(db, at, maestro, "verse", "verse-finanzas", def, { ...base, valor: "-3" })).mensaje).toContain("no es un monto válido");
    expect((await crearFila(db, at, maestro, "verse", "verse-finanzas", def, { ...base, foto: { url: "https://evil.example/x.jpg" } })).mensaje).toContain("soporte");
    expect((await crearFila(db, at, maestro, "verse", "verse-finanzas", def, { ...base, estado: "Pagado" })).mensaje).toContain('No se puede escribir "estado"');
    expect(filas()).toHaveLength(0);
  });
});
