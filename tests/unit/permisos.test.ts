import { describe, expect, it } from "vitest";
import { accesos, empresas, modulos, plantillas as tablaPlantillas, usuarios } from "@/db/esquema";
import { casillasVacias, type Casillas } from "@/lib/acceso/casillas";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import {
  alcanceHoy,
  empresasVisibles,
  ErrorAcceso,
  exigir,
  filtrarSuyo,
  limpiar,
  modulosVisibles,
  nivel,
  nivelCorreo,
  puedeAprobar,
  sensibles,
  type Sesion,
} from "@/lib/acceso/permisos";
import { PLANTILLAS, plantilla } from "@/lib/acceso/plantillas";
import { sembrar } from "@/lib/acceso/sembrar";
import { sesionDe } from "@/lib/acceso/sesion";
import { dbDePrueba } from "../apoyo/db";

const sesion = (accesosPorEmpresa: Record<string, Casillas>, extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "u1",
  correo: "persona@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Persona Prueba",
  accesos: accesosPorEmpresa,
  ...extra,
});

const conPlantilla = (id: string, extra: Partial<Sesion> = {}) => {
  const p = plantilla(id);
  return sesion({ [p.empresa]: p.casillas }, extra);
};

const TODOS = ESTRUCTURA.flatMap((e) => e.verticales.flatMap((v) => v.modulos.map((m) => ({ empresa: e.id, modulo: m.id }))));

/** Lo que cada plantilla debe ver, según el doc. Todo lo demás: sin acceso. */
const ESPERADO: Record<string, Record<string, "ver" | "editar">> = {
  "administrador-verse": {
    "verse-hoy": "editar",
    "verse-correo": "editar",
    "verse-finanzas": "ver",
    "verse-sistema": "ver",
    "host-operacion": "editar",
    "host-limpiezas": "editar",
    "host-ruta": "editar",
    "host-unidades": "editar",
    "host-liquidaciones": "editar",
    "host-alistamiento": "editar",
    "host-comercial": "editar",
    "host-tickets": "editar",
    "living-unidades": "editar",
    "living-contratos": "editar",
    "living-cobros": "editar",
    "living-balcony": "editar",
    "living-comercial": "editar",
  },
  "coordinacion-aseo": {
    "verse-hoy": "editar",
    "host-limpiezas": "editar",
    "host-ruta": "editar",
    "host-tickets": "editar",
    "host-operacion": "ver",
    "host-unidades": "ver",
  },
  living: {
    "verse-hoy": "editar",
    "verse-correo": "editar",
    "living-unidades": "editar",
    "living-contratos": "editar",
    "living-cobros": "editar",
    "living-balcony": "editar",
    "living-comercial": "editar",
  },
  comercial: { "verse-hoy": "editar", "verse-correo": "editar", "host-comercial": "editar", "living-comercial": "editar" },
  aseo: { "host-ruta": "editar" },
  obra: {
    "cyc-hoy": "editar",
    "cyc-correo": "editar",
    "obra-actas": "editar",
    "obra-pagos": "editar",
    "obra-contratistas": "editar",
    "obra-calidad": "editar",
    "obra-diseno": "editar",
  },
};

describe("permisos por plantilla", () => {
  for (const p of PLANTILLAS) {
    it(`${p.nombre}: cada módulo tiene exactamente el nivel del doc`, () => {
      const s = conPlantilla(p.id);
      const real = Object.fromEntries(TODOS.map(({ empresa, modulo }) => [modulo, nivel(s, empresa, modulo)]));
      const esperado = Object.fromEntries(TODOS.map(({ modulo }) => [modulo, ESPERADO[p.id]?.[modulo] ?? "sin"]));
      expect(real).toEqual(esperado);
    });
  }

  it("Aseo no ve nada fuera de su ruta, ni montos ni terceros, y los códigos solo en turno", () => {
    const s = conPlantilla("aseo");
    expect(empresasVisibles(s)).toEqual(["verse"]);
    expect(modulosVisibles(s, "verse")).toEqual(["host-ruta"]);
    expect(modulosVisibles(s, "cyc")).toEqual([]);
    expect(sensibles(s, "verse", "verse-host")).toEqual({ cifras: false, terceros: false, codigos: "turno" });
    expect(alcanceHoy(s, "verse")).toBe("suyo");
  });

  it("alguien sin C&C no ve nada de C&C", () => {
    for (const id of ["administrador-verse", "coordinacion-aseo", "living", "comercial", "aseo"]) {
      const s = conPlantilla(id);
      expect(empresasVisibles(s)).not.toContain("cyc");
      expect(modulosVisibles(s, "cyc")).toEqual([]);
      expect(alcanceHoy(s, "cyc")).toBeNull();
      expect(nivelCorreo(s, "cyc", "cyc-comercial")).toBe("sin");
      expect(sensibles(s, "cyc", "cyc-obra")).toEqual({ cifras: false, terceros: false, codigos: "nunca" });
    }
  });

  it("un módulo de otra empresa no se cuela pidiéndolo con la empresa equivocada", () => {
    const s = conPlantilla("obra");
    expect(nivel(s, "verse", "obra-actas")).toBe("sin");
    expect(nivel(s, "cyc", "obra-actas")).toBe("editar");
  });

  it("el Maestro ve y edita todo en todas las empresas", () => {
    const s = sesion({}, { maestro: true });
    expect(empresasVisibles(s)).toEqual(["verse", "cyc"]);
    for (const { empresa, modulo } of TODOS) expect(nivel(s, empresa, modulo)).toBe("editar");
    expect(puedeAprobar(s, "cyc")).toBe(true);
  });

  it("suspendido o invitado no ve nada, ni siendo Maestro", () => {
    for (const estado of ["suspendido", "invitado"] as const) {
      const s = sesion({ verse: plantilla("administrador-verse").casillas }, { estado, maestro: true });
      expect(empresasVisibles(s)).toEqual([]);
      expect(nivel(s, "verse", "verse-hoy")).toBe("sin");
    }
    expect(empresasVisibles(null)).toEqual([]);
  });

  it("exigir corta con ErrorAcceso", () => {
    expect(() => exigir(conPlantilla("aseo"), "verse", "verse-finanzas", "ver")).toThrow(ErrorAcceso);
    expect(() => exigir(conPlantilla("coordinacion-aseo"), "verse", "host-operacion", "editar")).toThrow(ErrorAcceso);
    expect(exigir(conPlantilla("coordinacion-aseo"), "verse", "host-operacion", "ver").usuarioId).toBe("u1");
  });

  it("correo por cuenta: Comercial redacta en contacto@ y no ve contabilidad@", () => {
    const s = conPlantilla("comercial");
    expect(nivelCorreo(s, "verse", "verse-contacto")).toBe("redactar");
    expect(nivelCorreo(s, "verse", "verse-contabilidad")).toBe("sin");
    expect(nivelCorreo(s, "verse", "cyc-comercial")).toBe("sin");
  });
});

describe("datos sensibles", () => {
  const filas = [{ unidad: "101", valor: 500000, celular: "3000000000", codigo: "1234", dia: "hoy" }];
  const reglas = { cifras: ["valor"] as const, terceros: ["celular"] as const, codigos: ["codigo"] as const };

  it("sin las casillas, los campos no salen en la respuesta", () => {
    const r = limpiar(filas, { cifras: false, terceros: false, codigos: "nunca" }, { cifras: ["valor"], terceros: ["celular"], codigos: ["codigo"] });
    expect(r).toEqual([{ unidad: "101", dia: "hoy" }]);
    expect(JSON.stringify(r)).not.toContain("500000");
  });

  it("con todas las casillas sale todo", () => {
    expect(limpiar(filas, { cifras: true, terceros: true, codigos: "siempre" }, { ...reglas, cifras: [...reglas.cifras], terceros: [...reglas.terceros], codigos: [...reglas.codigos] })).toEqual(filas);
  });

  it("códigos solo en su turno", () => {
    const sens = { cifras: false, terceros: false, codigos: "turno" as const };
    expect(limpiar(filas, sens, { codigos: ["codigo"], enTurno: (f) => f.dia === "hoy" })[0]).toHaveProperty("codigo", "1234");
    expect(limpiar(filas, sens, { codigos: ["codigo"], enTurno: () => false })[0]).not.toHaveProperty("codigo");
  });

  it("Hoy con alcance suyo solo devuelve filas donde la persona es Responsable", () => {
    const tareas = [{ responsable: "Persona Prueba" }, { responsable: "Otra" }, { responsable: null }];
    expect(filtrarSuyo(tareas, conPlantilla("living"), "verse")).toEqual([{ responsable: "Persona Prueba" }]);
    expect(filtrarSuyo(tareas, conPlantilla("administrador-verse"), "verse")).toHaveLength(3);
    expect(filtrarSuyo(tareas, conPlantilla("living", { nombreAirtable: null }), "verse")).toEqual([]);
    expect(filtrarSuyo(tareas, conPlantilla("living"), "cyc")).toEqual([]);
  });
});

describe("siembra y sesión", () => {
  it("siembra la estructura y las plantillas una sola vez, sin pisar cambios", async () => {
    const db = await dbDePrueba();
    await sembrar(db, { correo: "Maestro@Prueba.co", nombre: "Maestro" });
    await db.update(tablaPlantillas).set({ nombre: "Aseo editada" });
    await sembrar(db, { correo: "maestro@prueba.co", nombre: "Maestro" });
    expect(await db.select().from(empresas)).toHaveLength(2);
    expect(await db.select().from(modulos)).toHaveLength(TODOS.length);
    expect((await db.select().from(tablaPlantillas)).every((p) => p.nombre === "Aseo editada")).toBe(true);
    const [u] = await db.select().from(usuarios);
    expect(u).toMatchObject({ correo: "maestro@prueba.co", maestro: true, estado: "activo" });
  });

  it("la sesión se arma desde Postgres y refleja casillas y suspensión al instante", async () => {
    const db = await dbDePrueba();
    await sembrar(db);
    const [u] = await db.insert(usuarios).values({ nombre: "Persona", correo: "persona@prueba.co", estado: "activo" }).returning();
    await db.insert(accesos).values({ usuarioId: u!.id, empresaId: "verse", plantillaId: "aseo", casillas: plantilla("aseo").casillas });

    const s = await sesionDe(db, "PERSONA@prueba.co");
    expect(modulosVisibles(s, "verse")).toEqual(["host-ruta"]);

    await db.update(usuarios).set({ estado: "suspendido" });
    expect(modulosVisibles(await sesionDe(db, "persona@prueba.co"), "verse")).toEqual([]);
    expect(await sesionDe(db, "nadie@prueba.co")).toBeNull();
  });

  it("casillas vacías no abren nada", () => {
    const s = sesion({ verse: casillasVacias() });
    expect(empresasVisibles(s)).toEqual([]);
    expect(modulosVisibles(s, "verse")).toEqual([]);
  });
});
