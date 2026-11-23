import { beforeEach, describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "@/db/cliente";
import { mensajesAsistente, propuestas, unidades } from "@/db/esquema";
import { TABLAS } from "@/lib/airtable/mapeo";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { conversar, type Evento, type Llamar } from "@/lib/asistente/bucle";
import { definiciones, ejecutar, empresasDelAsistente } from "@/lib/asistente/herramientas";
import { costoUsd } from "@/lib/asistente/precios";
import { confirmarPropuesta, rechazarPropuesta } from "@/lib/asistente/propuestas";
import { reconciliar } from "@/lib/sync/reconciliar";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";

const TV = TABLAS.trazabilidadVerse;
const k = TV.campos;
const HOY = "2026-11-25";

const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "00000000-0000-0000-0000-000000000001",
  correo: "p@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Diana",
  accesos,
  ...extra,
});

let db: Db;
let at: AirtableFalso;
let maestro: Sesion;

beforeEach(async () => {
  db = await dbDePrueba();
  at = new AirtableFalso();
  const { usuarios } = await import("@/db/esquema");
  const [u] = await db.insert(usuarios).values({ nombre: "M", correo: "m@prueba.co", estado: "activo", maestro: true, nombreAirtable: "Felipe" }).returning();
  maestro = sesion({}, { usuarioId: u!.id, maestro: true, correo: "m@prueba.co", nombreAirtable: "Felipe" });
  const base = { [k.tipo.id]: "Pendiente", [k.estado.id]: "Abierto", [k.fechaLimite.id]: HOY, [k.proceso.id]: "Limpiezas" };
  at.poner(TV.idBase, TV.idTabla, { ...base, [k.id.id]: 295, [k.asunto.id]: "Póliza del Teik", [k.responsable.id]: "Felipe", [k.detalle.id]: "Crítico: Pagar la póliza" });
  at.poner(TV.idBase, TV.idTabla, { ...base, [k.id.id]: 296, [k.asunto.id]: "Lencería", [k.responsable.id]: "Diana", [k.detalle.id]: "Comprar sábanas" });
  await reconciliar(db, at, "trazabilidadVerse");
  await db.insert(unidades).values([{ recId: "recUNIDAD00000001", linea: "Host", unidad: "Teik 603", edificio: "Teik", estado: "Actual" }]);
});

const leer = (r: { contenido: string }) => JSON.parse(r.contenido);

describe("herramientas del asistente", () => {
  it("sin la casilla Asistente no hay asistente; el Maestro tiene acciones en las dos empresas", () => {
    expect(empresasDelAsistente(sesion({ verse: plantilla("living").casillas }))).toEqual([]);
    expect(empresasDelAsistente(maestro)).toEqual([
      { empresa: "verse", nivel: "acciones" },
      { empresa: "cyc", nivel: "acciones" },
    ]);
  });

  it("buscar pendientes respeta el alcance 'lo suyo'", async () => {
    const c = plantilla("living").casillas;
    const diana = sesion({ verse: { ...c, asistente: "consultas" } });
    const r = leer(await ejecutar("buscar_pendientes", {}, { db, sesion: diana, conversacionId: null, hoy: HOY }));
    expect(r.filas.map((f: { numero: number }) => f.numero)).toEqual([296]);
    const m = leer(await ejecutar("buscar_pendientes", { numero: 295 }, { db, sesion: maestro, conversacionId: null, hoy: HOY }));
    expect(m.filas[0]).toMatchObject({ numero: 295, critico: true, accion: "Pagar la póliza" });
  });

  it("resumen de Hoy cuenta por sección", async () => {
    const r = leer(await ejecutar("resumen_hoy", { empresa: "verse" }, { db, sesion: maestro, conversacionId: null, hoy: HOY }));
    expect(r.conteo).toEqual({ critico: 1, vencido: 0, hoy: 1, semana: 0 });
  });

  it("proponer no escribe en Airtable; solo crea la propuesta", async () => {
    const r = await ejecutar("proponer_cambio_pendiente", { empresa: "verse", numero: 295, accion: "cerrar" }, { db, sesion: maestro, conversacionId: null, hoy: HOY });
    expect(r.propuesta?.resumen).toBe("Cerrar: Póliza del Teik (fila 295)");
    expect(at.llamadas).not.toContain("actualizar");
    expect(await db.select().from(propuestas)).toHaveLength(1);
  });

  it("con asistente en 'consultas' no puede proponer cambios", async () => {
    const c = plantilla("administrador-verse").casillas;
    const s = sesion({ verse: { ...c, asistente: "consultas" } });
    const r = await ejecutar("proponer_cambio_pendiente", { empresa: "verse", numero: 296, accion: "cerrar" }, { db, sesion: s, conversacionId: null, hoy: HOY });
    expect(r.error).toBe(true);
    expect(await db.select().from(propuestas)).toHaveLength(0);
  });

  it("entradas inválidas vuelven como error para el modelo", async () => {
    const r = await ejecutar("proponer_cambio_pendiente", { empresa: "verse", numero: "x" }, { db, sesion: maestro, conversacionId: null, hoy: HOY });
    expect(r.error).toBe(true);
    expect(leer(r)).toHaveProperty("INVALID_JSON");
  });

  it("unidades solo con el módulo de unidades", async () => {
    expect(leer(await ejecutar("buscar_unidades", { texto: "teik" }, { db, sesion: maestro, conversacionId: null })).unidades).toEqual([
      { unidad: "Teik 603", edificio: "Teik", estado: "Actual", linea: "Host" },
    ]);
    const c = plantilla("comercial").casillas;
    expect((await ejecutar("buscar_unidades", { texto: "teik" }, { db, sesion: sesion({ verse: { ...c, asistente: "consultas" } }), conversacionId: null })).error).toBe(true);
  });

  it("todas las herramientas tienen esquema y transmiten la entrada en vivo", () => {
    for (const d of definiciones()) {
      expect(d.input_schema.type).toBe("object");
      expect(d.eager_input_streaming).toBe(true);
    }
  });
});

describe("propuestas", () => {
  it("confirmar ejecuta por la cola; cancelar no toca Airtable", async () => {
    await ejecutar("proponer_cambio_pendiente", { empresa: "verse", numero: 295, accion: "cerrar" }, { db, sesion: maestro, conversacionId: null, hoy: HOY });
    await ejecutar("proponer_cambio_pendiente", { empresa: "verse", numero: 296, accion: "descartar" }, { db, sesion: maestro, conversacionId: null, hoy: HOY });
    const [p1, p2] = await db.select().from(propuestas).orderBy(propuestas.creado);
    expect((await confirmarPropuesta(db, at, maestro, p1!.id)).ok).toBe(true);
    expect((await rechazarPropuesta(db, maestro, p2!.id)).ok).toBe(true);
    const estados = [...at.tablas.get(`${TV.idBase}/${TV.idTabla}`)!.values()].map((r) => [r.fields[k.id.id], r.fields[k.estado.id]]);
    expect(estados).toEqual([
      [295, "Hecho"],
      [296, "Abierto"],
    ]);
    expect((await confirmarPropuesta(db, at, maestro, p1!.id)).mensaje).toBe("Esa propuesta ya se respondió");
  });

  it("crear pendiente lo escribe con las convenciones de TRAZABILIDAD", async () => {
    await ejecutar(
      "proponer_nuevo_pendiente",
      { empresa: "verse", asunto: "Llamar a la administración", detalle: "Llamar para pedir el estado de cuenta", responsable: "Diana", fecha_limite: "2026-11-26", linea: "Grupo" },
      { db, sesion: maestro, conversacionId: null, hoy: HOY },
    );
    const [p] = await db.select().from(propuestas);
    expect((await confirmarPropuesta(db, at, maestro, p!.id)).ok).toBe(true);
    const nueva = [...at.tablas.get(`${TV.idBase}/${TV.idTabla}`)!.values()].find((r) => r.fields[k.asunto.id] === "Llamar a la administración");
    expect(nueva?.fields).toMatchObject({ [k.tipo.id]: "Pendiente", [k.estado.id]: "Abierto", [k.proceso.id]: "Verse OS", [k.mes.id]: "2026-11", [k.linea.id]: "Grupo" });
  });

  it("una persona no puede confirmar la propuesta de otra", async () => {
    await ejecutar("proponer_cambio_pendiente", { empresa: "verse", numero: 295, accion: "cerrar" }, { db, sesion: maestro, conversacionId: null, hoy: HOY });
    const [p] = await db.select().from(propuestas);
    expect((await confirmarPropuesta(db, at, { ...maestro, usuarioId: "00000000-0000-0000-0000-000000000009" }, p!.id)).mensaje).toBe("Esa propuesta no existe");
  });
});

function respuesta(contenido: unknown[], stop: string, uso = { input_tokens: 1000, output_tokens: 200 }): Anthropic.Beta.BetaMessage {
  return { id: "msg", type: "message", role: "assistant", model: "claude-sonnet-5-5", content: contenido, stop_reason: stop, usage: uso } as unknown as Anthropic.Beta.BetaMessage;
}

describe("ciclo del asistente", () => {
  it("usa una herramienta, responde, guarda el costo y manda la propuesta a la pantalla", async () => {
    const pedidos: unknown[] = [];
    const turnos = [
      respuesta([{ type: "tool_use", id: "t1", name: "proponer_cambio_pendiente", input: { empresa: "verse", numero: 295, accion: "cerrar" } }], "tool_use"),
      respuesta([{ type: "text", text: "Quedó por confirmar el cierre de la fila 295." }], "end_turn"),
    ];
    const llamar: Llamar = async (params, alTexto) => {
      pedidos.push(params);
      const r = turnos.shift()!;
      for (const b of r.content) if (b.type === "text") alTexto(b.text);
      return r;
    };
    const eventos: Evento[] = [];
    const r = await conversar({ db, sesion: maestro, llamar, texto: "listo 295", pantalla: { ruta: "/hoy" }, alEvento: (e) => eventos.push(e), ahora: new Date("2026-11-25T15:00:00Z") });

    expect(eventos.map((e) => e.tipo)).toEqual(["conversacion", "herramienta", "propuesta", "texto", "fin"]);
    expect(r.costoUsd).toBeCloseTo(2 * costoUsd("claude-sonnet-5-5", { input_tokens: 1000, output_tokens: 200 }));
    const primero = pedidos[0] as { model: string; fallbacks: string; betas: string[]; messages: { content: { text: string }[] }[] };
    expect(primero).toMatchObject({ model: "claude-sonnet-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
    expect(primero.messages[0]!.content[0]!.text).toContain("Fecha de hoy en Bogotá: 2026-11-25. Pantalla: /hoy.");
    const guardados = await db.select().from(mensajesAsistente);
    expect(guardados.map((m) => m.rol)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(guardados.reduce((n, m) => n + m.costoUsd, 0)).toBeCloseTo(r.costoUsd);
  });

  it("la segunda pregunta reenvía la historia sin cambios", async () => {
    const pedidos: { messages: unknown[] }[] = [];
    const llamar: Llamar = async (params) => {
      pedidos.push(params as unknown as { messages: unknown[] });
      return respuesta([{ type: "text", text: "Hola" }], "end_turn");
    };
    const { conversacionId } = await conversar({ db, sesion: maestro, llamar, texto: "hola", alEvento: () => undefined });
    await conversar({ db, sesion: maestro, llamar, texto: "otra", conversacionId, alEvento: () => undefined });
    expect(pedidos[1]!.messages).toHaveLength(3);
  });

  it("un rechazo termina la vuelta con un aviso y no ejecuta herramientas", async () => {
    const eventos: Evento[] = [];
    const llamar: Llamar = async () => respuesta([{ type: "tool_use", id: "t", name: "proponer_cambio_pendiente", input: {} }], "refusal");
    await conversar({ db, sesion: maestro, llamar, texto: "x", alEvento: (e) => eventos.push(e) });
    expect(eventos.some((e) => e.tipo === "aviso")).toBe(true);
    expect(await db.select().from(propuestas)).toHaveLength(0);
  });

  it("no retoma la conversación de otra persona", async () => {
    const llamar: Llamar = async () => respuesta([{ type: "text", text: "ok" }], "end_turn");
    const { conversacionId } = await conversar({ db, sesion: maestro, llamar, texto: "hola", alEvento: () => undefined });
    const { usuarios } = await import("@/db/esquema");
    const [otro] = await db.insert(usuarios).values({ nombre: "O", correo: "o@prueba.co", estado: "activo", maestro: true }).returning();
    const r = await conversar({ db, sesion: { ...maestro, usuarioId: otro!.id }, llamar, texto: "hola", conversacionId, alEvento: () => undefined });
    expect(r.conversacionId).not.toBe(conversacionId);
  });
});

describe("costo", () => {
  it("Sonnet 5.5: 2 y 10 dólares por millón, caché leída a 0,10", () => {
    expect(costoUsd("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 })).toBeCloseTo(12.1);
  });
});

