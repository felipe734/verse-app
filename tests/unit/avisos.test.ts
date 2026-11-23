import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/cliente";
import { avisos, suscripcionesPush, tareas, usuarios } from "@/db/esquema";
import { crearUsuario, guardarAcceso } from "@/lib/acceso/admin";
import { sembrar } from "@/lib/acceso/sembrar";
import { sesionDe } from "@/lib/acceso/sesion";
import type { TareaHoy } from "@/lib/hoy/clasificar";
import { avisarCambios, avisoDe, avisoDeFallaApp, enviarAvisos, type Enviar } from "@/lib/notificaciones/avisos";
import { eq } from "drizzle-orm";
import { dbDePrueba } from "../apoyo/db";

const t = (p: Partial<TareaHoy>): TareaHoy => ({
  recId: "recFILA0000000001",
  empresa: "Verse",
  numero: 1,
  tipo: "Pendiente",
  asunto: "Póliza",
  proceso: "Pólizas",
  estado: "Abierto",
  responsable: "Diana",
  fechaLimite: "2026-11-25",
  detalle: "Revisar",
  link: null,
  linea: "Verse Host",
  corrida: [],
  ...p,
});

describe("qué aviso sale de cada fila", () => {
  it("crítico, aprobar y falla; nada para lo normal o cerrado", () => {
    expect(avisoDe(t({ detalle: "Crítico: Pagar la póliza hoy" }))).toMatchObject({ tipo: "critico", titulo: "Crítico · Póliza", cuerpo: "Pagar la póliza hoy", url: "/hoy?empresa=verse" });
    expect(avisoDe(t({ detalle: "Aprobar: CRUCES de 10 a 12" }))).toMatchObject({ tipo: "aprobar", url: "/aprobar" });
    expect(avisoDe(t({ tipo: "Corrida", estado: "Falló", asunto: "Programación no salió", proceso: "Limpiezas" }))).toMatchObject({ tipo: "falla", titulo: "Falló · Programación no salió" });
    expect(avisoDe(t({}))).toBeNull();
    expect(avisoDe(t({ detalle: "Crítico: algo", estado: "Hecho" }))).toBeNull();
    expect(avisoDe(t({ detalle: "Aprobar: algo\nAprobado en la app por f@p.co el 2026-11-25" }))).toBeNull();
  });
});

describe("envío de avisos", () => {
  let db: Db;
  let enviados: { endpoint: string; titulo: string }[];
  let respuesta: number;
  const enviar: Enviar = async (sub, carga) => {
    enviados.push({ endpoint: sub.endpoint, titulo: carga.titulo });
    return respuesta;
  };

  async function persona(correo: string, empresa: string, plantillaId: string, nombreAirtable: string) {
    const maestro = (await sesionDe(db, "maestro@prueba.co"))!;
    const id = await crearUsuario(db, maestro, { nombre: correo, correo, nombreAirtable });
    await guardarAcceso(db, maestro, id, empresa, { plantillaId });
    await db.update(usuarios).set({ estado: "activo" }).where(eq(usuarios.id, id));
    await db.insert(suscripcionesPush).values({ usuarioId: id, endpoint: `https://push.prueba/${correo}`, p256dh: "clave-p256dh-de-prueba", auth: "auth-de-prueba" });
    return id;
  }

  beforeEach(async () => {
    db = await dbDePrueba();
    enviados = [];
    respuesta = 201;
    await sembrar(db, { correo: "maestro@prueba.co", nombre: "Maestro" });
    const [m] = await db.select().from(usuarios);
    await db.insert(suscripcionesPush).values({ usuarioId: m!.id, endpoint: "https://push.prueba/maestro", p256dh: "clave-p256dh-de-prueba", auth: "auth-de-prueba" });
    await persona("diana@prueba.co", "verse", "living", "Diana");
    await persona("aseo@prueba.co", "verse", "aseo", "Edy");
  });

  it("el crítico llega a quien ve Hoy con ese pendiente en su alcance, y solo una vez", async () => {
    await db.insert(tareas).values({ ...t({ detalle: "Crítico: Pagar" }) });
    await avisarCambios(db, ["recFILA0000000001"], enviar);
    expect(enviados.map((e) => e.endpoint).sort()).toEqual(["https://push.prueba/diana@prueba.co", "https://push.prueba/maestro"]);
    await avisarCambios(db, ["recFILA0000000001"], enviar);
    expect(enviados).toHaveLength(2);
    const [a] = await db.select().from(avisos);
    expect(a).toMatchObject({ clave: "critico:recFILA0000000001", destinatarios: 2, enviados: 2 });
  });

  it("aprobar solo llega a quien tiene la casilla Aprobar", async () => {
    await db.insert(tareas).values({ ...t({ detalle: "Aprobar: algo" }) });
    await avisarCambios(db, ["recFILA0000000001"], enviar);
    expect(enviados.map((e) => e.endpoint)).toEqual(["https://push.prueba/maestro"]);
  });

  it("una falla de la app llega a quien ve Sistema de Verse", async () => {
    await enviarAvisos(db, [avisoDeFallaApp("respaldo:2026-11-25", "Falló el respaldo", "motivo")], enviar);
    expect(enviados.map((e) => e.endpoint)).toEqual(["https://push.prueba/maestro"]);
  });

  it("un dispositivo que ya no existe (410) se desactiva", async () => {
    respuesta = 410;
    await enviarAvisos(db, [avisoDeFallaApp("x", "Falla", "motivo")], enviar);
    const [sub] = await db.select().from(suscripcionesPush).where(eq(suscripcionesPush.endpoint, "https://push.prueba/maestro"));
    expect(sub?.activa).toBe(false);
  });

  it("sin claves VAPID solo se registra, sin enviar", async () => {
    await db.insert(tareas).values({ ...t({ detalle: "Crítico: Pagar" }) });
    await avisarCambios(db, ["recFILA0000000001"], null);
    expect(enviados).toEqual([]);
    const [a] = await db.select().from(avisos);
    expect(a?.sembrado).toBe(true);
  });
});
