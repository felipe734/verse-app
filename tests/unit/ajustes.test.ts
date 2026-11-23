import { beforeEach, describe, expect, it } from "vitest";
import { accesos, auditoria, usuarios } from "@/db/esquema";
import type { Db } from "@/db/cliente";
import {
  actualizarUsuario,
  cambiarEstado,
  crearEmpresa,
  crearInvitacion,
  crearUsuario,
  crearVertical,
  exigirMaestro,
  guardarAcceso,
  quitarAcceso,
  revisarInvitacion,
  usarInvitacion,
} from "@/lib/acceso/admin";
import { decidirEntrada } from "@/lib/acceso/entrada";
import { empresaBase } from "@/lib/acceso/estructura";
import { casillasDesdeFormulario } from "@/lib/acceso/formulario";
import { ErrorAcceso, modulosVisibles, type Sesion } from "@/lib/acceso/permisos";
import { PLANTILLAS, plantilla } from "@/lib/acceso/plantillas";
import { sembrar } from "@/lib/acceso/sembrar";
import { sesionDe } from "@/lib/acceso/sesion";
import { dbDePrueba } from "../apoyo/db";

let db: Db;
let maestro: Sesion;

beforeEach(async () => {
  db = await dbDePrueba();
  await sembrar(db, { correo: "maestro@prueba.co", nombre: "Maestro" });
  maestro = (await sesionDe(db, "maestro@prueba.co"))!;
});

const datos = { nombre: "Persona Prueba", correo: "Persona@Prueba.co", celular: "3000000000", nombreAirtable: "Persona" };

describe("Ajustes es solo del Maestro", () => {
  for (const p of PLANTILLAS) {
    it(`con la plantilla ${p.nombre} ninguna operación de Ajustes pasa`, async () => {
      const s: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000000", correo: "x@prueba.co", estado: "activo", maestro: false, nombreAirtable: null, accesos: { [p.empresa]: p.casillas } };
      expect(() => exigirMaestro(s)).toThrow(ErrorAcceso);
      await expect(crearUsuario(db, s, datos)).rejects.toThrow(ErrorAcceso);
      await expect(guardarAcceso(db, s, maestro.usuarioId, "verse", { plantillaId: "aseo" })).rejects.toThrow(ErrorAcceso);
      await expect(crearInvitacion(db, s, maestro.usuarioId)).rejects.toThrow(ErrorAcceso);
      await expect(cambiarEstado(db, s, maestro.usuarioId, "suspendido")).rejects.toThrow(ErrorAcceso);
      await expect(crearEmpresa(db, s, "Otra")).rejects.toThrow(ErrorAcceso);
    });
  }

  it("un Maestro suspendido tampoco", () => {
    expect(() => exigirMaestro({ ...maestro, estado: "suspendido" })).toThrow(ErrorAcceso);
  });
});

describe("usuarios y casillas", () => {
  it("crea el usuario como invitado, normaliza el correo y no repite correos", async () => {
    const id = await crearUsuario(db, maestro, datos);
    const [u] = (await db.select().from(usuarios)).filter((x) => x.id === id);
    expect(u).toMatchObject({ correo: "persona@prueba.co", estado: "invitado", nombreAirtable: "Persona" });
    await expect(crearUsuario(db, maestro, { ...datos, correo: "persona@prueba.co" })).rejects.toThrow("Ya existe");
  });

  it("la plantilla llena las casillas y después se ajustan una por una, con auditoría", async () => {
    const id = await crearUsuario(db, maestro, datos);
    await guardarAcceso(db, maestro, id, "verse", { plantillaId: "coordinacion-aseo" });
    const casillas = { ...plantilla("coordinacion-aseo").casillas, modulos: { ...plantilla("coordinacion-aseo").casillas.modulos, "host-operacion": "editar" as const } };
    await guardarAcceso(db, maestro, id, "verse", { casillas });
    const [a] = await db.select().from(accesos);
    expect(a).toMatchObject({ plantillaId: null, casillas: expect.objectContaining({ modulos: expect.objectContaining({ "host-operacion": "editar" }) }) });
    const registro = (await db.select().from(auditoria)).filter((r) => r.accion === "acceso.casillas");
    expect(registro).toHaveLength(2);
    expect(registro[1]?.antes).toMatchObject({ modulos: expect.objectContaining({ "host-operacion": "ver" }) });
  });

  it("una plantilla de otra empresa no se puede aplicar", async () => {
    const id = await crearUsuario(db, maestro, datos);
    await expect(guardarAcceso(db, maestro, id, "cyc", { plantillaId: "aseo" })).rejects.toThrow("no es de esta empresa");
  });

  it("quitar el acceso a una empresa la deja sin nada", async () => {
    const id = await crearUsuario(db, maestro, datos);
    await guardarAcceso(db, maestro, id, "cyc", { plantillaId: "obra" });
    await quitarAcceso(db, maestro, id, "cyc");
    expect(await db.select().from(accesos)).toHaveLength(0);
  });

  it("suspender corta el acceso al instante; el Maestro no se suspende a sí mismo", async () => {
    const id = await crearUsuario(db, maestro, datos);
    await db.update(usuarios).set({ estado: "activo", ultimoIngreso: new Date() });
    await guardarAcceso(db, maestro, id, "verse", { plantillaId: "aseo" });
    await cambiarEstado(db, maestro, id, "suspendido");
    expect(modulosVisibles(await sesionDe(db, "persona@prueba.co"), "verse")).toEqual([]);
    await expect(cambiarEstado(db, maestro, maestro.usuarioId, "suspendido")).rejects.toThrow("a ti mismo");
  });

  it("reactivar a quien nunca entró lo deja invitado", async () => {
    const id = await crearUsuario(db, maestro, datos);
    await cambiarEstado(db, maestro, id, "suspendido");
    await cambiarEstado(db, maestro, id, "activo");
    const u = (await db.select().from(usuarios)).find((x) => x.id === id);
    expect(u?.estado).toBe("invitado");
  });

  it("editar los datos deja antes y después en auditoría", async () => {
    const id = await crearUsuario(db, maestro, datos);
    await actualizarUsuario(db, maestro, id, { ...datos, nombreAirtable: "Persona P" });
    const r = (await db.select().from(auditoria)).find((x) => x.accion === "acceso.usuario_editado");
    expect(r).toMatchObject({ antes: expect.objectContaining({ nombreAirtable: "Persona" }), despues: expect.objectContaining({ nombreAirtable: "Persona P" }) });
  });
});

describe("invitaciones", () => {
  it("el enlace activa la cuenta solo con el mismo correo de Google y una sola vez", async () => {
    const id = await crearUsuario(db, maestro, datos);
    const { token } = await crearInvitacion(db, maestro, id);
    expect(await revisarInvitacion(db, token)).toMatchObject({ valida: true, correo: "persona@prueba.co" });

    expect(await decidirEntrada(db, "otra@gmail.com", true, token)).toEqual({ ok: false, motivo: "sin-invitacion" });
    expect(await usarInvitacion(db, token, "otra@gmail.com")).toBe(false);
    expect(await decidirEntrada(db, "persona@prueba.co", true, null)).toEqual({ ok: false, motivo: "invitacion-pendiente" });

    const r = await decidirEntrada(db, "Persona@prueba.co", true, token);
    expect(r.ok).toBe(true);
    expect((await sesionDe(db, "persona@prueba.co"))?.estado).toBe("activo");
    expect(await revisarInvitacion(db, token)).toEqual({ valida: false, motivo: "usada" });
  });

  it("el enlace vence a los 7 días y uno inventado no sirve", async () => {
    const id = await crearUsuario(db, maestro, datos);
    const { token } = await crearInvitacion(db, maestro, id, new Date("2026-11-01T12:00:00Z"));
    expect(await revisarInvitacion(db, token, new Date("2026-11-07T12:00:00Z"))).toMatchObject({ valida: true });
    expect(await revisarInvitacion(db, token, new Date("2026-11-08T13:00:00Z"))).toEqual({ valida: false, motivo: "vencida" });
    expect(await revisarInvitacion(db, "inventado")).toEqual({ valida: false, motivo: "no-existe" });
  });

  it("solo se guarda el hash del enlace", async () => {
    const id = await crearUsuario(db, maestro, datos);
    const { token } = await crearInvitacion(db, maestro, id);
    const { invitaciones } = await import("@/db/esquema");
    const [fila] = await db.select().from(invitaciones);
    expect(fila?.hash).not.toBe(token);
    expect(JSON.stringify(await db.select().from(auditoria))).not.toContain(token);
  });
});

describe("estructura editable", () => {
  it("crea empresa con su vertical General y nuevas verticales; la sesión las ve", async () => {
    const id = await crearEmpresa(db, maestro, "Inversiones Ñandú");
    expect(id).toBe("inversiones-nandu");
    await crearVertical(db, maestro, id, "Arriendos");
    const s = (await sesionDe(db, "maestro@prueba.co"))!;
    expect(s.estructura?.find((e) => e.id === id)?.verticales.map((v) => v.nombre)).toEqual(["General", "Arriendos"]);
    await expect(crearEmpresa(db, maestro, "Inversiones Ñandú")).rejects.toThrow("Ya existe");
  });
});

describe("formulario de casillas", () => {
  it("lee solo módulos, cuentas y verticales de la empresa", () => {
    const f = new Map<string, string>([
      ["m:host-ruta", "editar"],
      ["m:verse-hoy", "ver"],
      ["m:obra-actas", "editar"],
      ["m:host-limpiezas", "inventado"],
      ["c:verse-contacto", "redactar"],
      ["cif:verse-host", "on"],
      ["cod:verse-host", "turno"],
      ["alcance", "todo"],
      ["aprobar", "on"],
      ["asistente", "consultas"],
    ]);
    const c = casillasDesdeFormulario(f, empresaBase("verse"));
    expect(c).toEqual({
      modulos: { "verse-hoy": "ver", "host-ruta": "editar" },
      alcanceHoy: "todo",
      aprobar: true,
      correo: { "verse-contacto": "redactar" },
      cifras: { "verse-host": true },
      codigos: { "verse-host": "turno" },
      terceros: {},
      descargar: false,
      asistente: "consultas",
    });
  });
});
