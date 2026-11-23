import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { registros, tareas } from "@/db/esquema";
import { TABLAS } from "@/lib/airtable/mapeo";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { accion, diasDeAtraso, etiquetaAtraso, finDeSemana, hoyBogota, seccionDe, type TareaHoy } from "@/lib/hoy/clasificar";
import { hoyDe } from "@/lib/hoy/datos";
import { reproyectar } from "@/lib/sync/guardar";
import { dbDePrueba } from "../apoyo/db";

const HOY = "2026-11-25"; // miércoles
const AHORA = new Date("2026-11-25T15:00:00Z");

const t = (p: Partial<TareaHoy>): TareaHoy => ({
  recId: `rec${Math.random().toString(36).slice(2, 16).padEnd(14, "0")}`,
  empresa: "Verse",
  numero: 1,
  tipo: "Pendiente",
  asunto: "Tarea de prueba",
  proceso: "Limpiezas",
  estado: "Abierto",
  responsable: "Felipe",
  fechaLimite: HOY,
  detalle: "Revisar algo",
  link: null,
  linea: "Verse Host",
  corrida: [],
  ...p,
});

describe("clasificación de Hoy", () => {
  it("el día es el de Bogotá y la semana termina el domingo", () => {
    expect(hoyBogota(new Date("2026-11-26T03:00:00Z"))).toBe("2026-11-25");
    expect(finDeSemana(HOY)).toBe("2026-11-29");
    expect(finDeSemana("2026-11-29")).toBe("2026-11-29");
  });

  it("Crítico va primero aunque venza después; luego Vencido, Hoy y Esta semana", () => {
    expect(seccionDe(t({ detalle: "Crítico: Pagar la póliza", fechaLimite: "2026-11-28" }), HOY)).toBe("critico");
    expect(seccionDe(t({ fechaLimite: "2026-11-20" }), HOY)).toBe("vencido");
    expect(seccionDe(t({ fechaLimite: HOY }), HOY)).toBe("hoy");
    expect(seccionDe(t({ fechaLimite: null }), HOY)).toBe("hoy");
    expect(seccionDe(t({ fechaLimite: "2026-11-29" }), HOY)).toBe("semana");
    expect(seccionDe(t({ fechaLimite: "2026-11-30" }), HOY)).toBeNull();
  });

  it("no salen las Corridas, lo cerrado, lo Para aprobar ni lo En espera futuro", () => {
    expect(seccionDe(t({ tipo: "Corrida", estado: "OK" }), HOY)).toBeNull();
    expect(seccionDe(t({ estado: "Hecho" }), HOY)).toBeNull();
    expect(seccionDe(t({ estado: "Descartado" }), HOY)).toBeNull();
    expect(seccionDe(t({ detalle: "Aprobar: cambiar X de 1 a 2" }), HOY)).toBeNull();
    expect(seccionDe(t({ estado: "En espera", fechaLimite: "2026-11-27" }), HOY)).toBeNull();
    expect(seccionDe(t({ estado: "En espera", fechaLimite: HOY }), HOY)).toBe("hoy");
  });

  it("antigüedad: 3 urgente, 7 atascado, 14 escalado", () => {
    expect(diasDeAtraso(t({ fechaLimite: "2026-11-22" }), HOY)).toBe(3);
    expect(etiquetaAtraso(2)).toBeNull();
    expect(etiquetaAtraso(3)).toBe("Urgente");
    expect(etiquetaAtraso(7)).toBe("Atascado");
    expect(etiquetaAtraso(14)).toBe("Escalado");
  });

  it("la acción es la primera línea del Detalle sin la etiqueta Crítico", () => {
    expect(accion(t({ detalle: "Crítico: Enviar el archivo\ncontexto" }))).toBe("Enviar el archivo");
  });
});

describe("Hoy desde la copia, con permisos", () => {
  let db: Db;
  const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
    usuarioId: "u",
    correo: "p@prueba.co",
    estado: "activo",
    maestro: false,
    nombreAirtable: "Diana",
    accesos,
    ...extra,
  });

  beforeEach(async () => {
    db = await dbDePrueba();
    await db.insert(tareas).values([
      { ...t({ asunto: "De Diana", responsable: "Diana", fechaLimite: "2026-11-20" }), recId: "recDIANA000000001" },
      { ...t({ asunto: "De Felipe", responsable: "Felipe" }), recId: "recFELIPE00000001" },
      { ...t({ asunto: "Crítico de Felipe", detalle: "Crítico: Pagar", fechaLimite: "2026-11-28" }), recId: "recCRITICO0000001" },
      { ...t({ asunto: "Obra", empresa: "C&C", responsable: "Diana" }), recId: "recOBRA0000000001" },
      { ...t({ asunto: "Aprobar", detalle: "Aprobar: algo" }), recId: "recAPROBAR0000001" },
      { ...t({ asunto: "Cerrada", estado: "Hecho" }), recId: "recCERRADA0000001" },
    ]);
  });

  it("el Maestro ve todo lo abierto de las dos empresas, sin lo Para aprobar ni lo cerrado", async () => {
    const h = await hoyDe(db, sesion({}, { maestro: true }), ["verse", "cyc"], AHORA);
    const por = Object.fromEntries(h.secciones.map((s) => [s.id, s.items.map((i) => i.asunto)]));
    expect(por).toEqual({ critico: ["Crítico de Felipe"], vencido: ["De Diana"], hoy: ["De Felipe", "Obra"], semana: [] });
    expect(h.total).toBe(4);
  });

  it("con alcance 'lo suyo' solo salen las filas donde es Responsable", async () => {
    const s = sesion({ verse: plantilla("living").casillas });
    const h = await hoyDe(db, s, ["verse", "cyc"], AHORA);
    expect(h.secciones.flatMap((x) => x.items.map((i) => i.asunto))).toEqual(["De Diana"]);
  });

  it("sin el módulo Hoy no sale nada, y sin C&C no sale la obra", async () => {
    expect((await hoyDe(db, sesion({ verse: plantilla("aseo").casillas }), ["verse"], AHORA)).total).toBe(0);
    const admin = await hoyDe(db, sesion({ verse: plantilla("administrador-verse").casillas }), ["verse", "cyc"], AHORA);
    expect(admin.secciones.flatMap((x) => x.items.map((i) => i.empresa))).not.toContain("C&C");
  });
});

describe("reproyección", () => {
  it("rehace tareas desde la copia con Línea y Creado, sin Airtable", async () => {
    const db = await dbDePrueba();
    const tv = TABLAS.trazabilidadVerse;
    await db.insert(registros).values({
      idBase: tv.idBase,
      idTabla: tv.idTabla,
      recId: "recREPRO00000001",
      campos: { [tv.campos.asunto.id]: "Reproyectada", [tv.campos.linea.id]: "Verse Living", [tv.campos.tipo.id]: "Pendiente" },
      huella: "x",
      creadoEnAirtable: new Date("2026-11-01T10:00:00Z"),
    });
    expect(await reproyectar(db)).toBe(1);
    const [fila] = await db.select().from(tareas);
    expect(fila).toMatchObject({ asunto: "Reproyectada", linea: "Verse Living", creado: new Date("2026-11-01T10:00:00Z") });
  });
});
