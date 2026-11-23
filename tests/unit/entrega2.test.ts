/**
 * Listo cuando (doc, entrega 2): un usuario Aseo de prueba no ve nada fuera de su ruta
 * y uno sin C&C no ve nada de C&C. Se prueba con usuarios reales en Postgres, por la
 * misma vía que usa la app: Ajustes → sesión desde la base → vista de Hoy.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { crearUsuario, guardarAcceso } from "@/lib/acceso/admin";
import { usuarios } from "@/db/esquema";
import { limpiar, nivelCorreo, sensibles, type Sesion } from "@/lib/acceso/permisos";
import { sembrar } from "@/lib/acceso/sembrar";
import { sesionDe, sesionPorId } from "@/lib/acceso/sesion";
import { TODAS, vistaHoy } from "@/lib/acceso/vista";
import { dbDePrueba } from "../apoyo/db";

let db: Db;
let maestro: Sesion;
let aseo: Sesion;
let sinCyC: Sesion;

async function usuarioActivo(correo: string, empresa: string, plantillaId: string): Promise<Sesion> {
  const id = await crearUsuario(db, maestro, { nombre: correo, correo, nombreAirtable: correo });
  await guardarAcceso(db, maestro, id, empresa, { plantillaId });
  await db.update(usuarios).set({ estado: "activo" }).where(eq(usuarios.id, id));
  return (await sesionDe(db, correo))!;
}

const modulos = (v: ReturnType<typeof vistaHoy>) => v.grupos.flatMap((g) => g.modulos.map((m) => m.id));

beforeEach(async () => {
  db = await dbDePrueba();
  await sembrar(db, { correo: "maestro@prueba.co", nombre: "Maestro" });
  maestro = (await sesionDe(db, "maestro@prueba.co"))!;
  aseo = await usuarioActivo("aseo@prueba.co", "verse", "aseo");
  sinCyC = await usuarioActivo("admin@prueba.co", "verse", "administrador-verse");
});

describe("entrega 2 · listo cuando", () => {
  it("el usuario Aseo de prueba no ve nada fuera de su ruta", () => {
    for (const pedida of [undefined, "verse", "cyc", TODAS, "inventada"]) {
      const v = vistaHoy(aseo, pedida);
      expect(v.empresas.map((e) => e.id)).toEqual(["verse"]);
      expect(v.todas).toBe(false);
      expect(modulos(v)).toEqual(["host-ruta"]);
    }
    expect(sensibles(aseo, "verse", "verse-host")).toEqual({ cifras: false, terceros: false, codigos: "turno" });
    const fila = { unidad: "101", valor: 1, celular: "300", codigo: "1234" };
    expect(limpiar([fila], sensibles(aseo, "verse", "verse-host"), { cifras: ["valor"], terceros: ["celular"], codigos: ["codigo"], enTurno: () => false })).toEqual([{ unidad: "101" }]);
  });

  it("el usuario sin C&C no ve nada de C&C, ni pidiéndolo", () => {
    for (const pedida of [undefined, "cyc", TODAS]) {
      const v = vistaHoy(sinCyC, pedida);
      expect(v.empresas.map((e) => e.id)).toEqual(["verse"]);
      expect(v.grupos.every((g) => g.empresa === "Verse Group")).toBe(true);
      expect(modulos(v).some((m) => m.startsWith("cyc-") || m.startsWith("obra-"))).toBe(false);
    }
    expect(nivelCorreo(sinCyC, "cyc", "cyc-comercial")).toBe("sin");
    expect(sensibles(sinCyC, "cyc", "cyc-obra")).toEqual({ cifras: false, terceros: false, codigos: "nunca" });
  });

  it("Ver como muestra exactamente lo mismo que verá la persona", async () => {
    const comoAseo = await sesionPorId(db, aseo.usuarioId);
    expect(vistaHoy(comoAseo, TODAS)).toEqual(vistaHoy(aseo, TODAS));
  });

  it("el Maestro tiene Todas, con los módulos de Verse y de C&C juntos", () => {
    const v = vistaHoy(maestro, TODAS);
    expect(v.todas).toBe(true);
    expect(v.empresa).toBe(TODAS);
    expect(modulos(v)).toContain("host-ruta");
    expect(modulos(v)).toContain("obra-actas");
    expect(new Set(v.grupos.map((g) => g.empresa))).toEqual(new Set(["Verse Group", "C&C Group"]));
  });

  it("quien tiene las dos empresas por plantilla también ve Todas, y solo lo suyo", async () => {
    const { usuarioId } = await usuarioActivo("doble@prueba.co", "verse", "coordinacion-aseo");
    await guardarAcceso(db, maestro, usuarioId, "cyc", { plantillaId: "obra" });
    const s = (await sesionDe(db, "doble@prueba.co"))!;
    const v = vistaHoy(s, TODAS);
    expect(v.todas).toBe(true);
    expect(modulos(v)).toEqual(
      expect.arrayContaining(["verse-hoy", "host-limpiezas", "host-ruta", "host-operacion", "host-unidades", "cyc-hoy", "obra-actas"]),
    );
    expect(modulos(v)).not.toContain("verse-finanzas");
    expect(modulos(v)).not.toContain("cyc-finanzas");
  });
});
