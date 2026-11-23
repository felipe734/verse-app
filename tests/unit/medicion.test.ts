import { describe, expect, it } from "vitest";
import { costosNeon, llamadasAirtable } from "@/db/esquema";
import { crearCliente } from "@/lib/airtable/cliente";
import { TABLAS } from "@/lib/airtable/mapeo";
import { crearContador, diaBogota, workspaceDe } from "@/lib/medicion/contador";
import { calcularCosto, guardarCostoNeon, leerCostoNeon } from "@/lib/medicion/neon";
import { dbDePrueba } from "../apoyo/db";

const respuestaVacia = async () => new Response(JSON.stringify({ records: [] }), { status: 200 });

describe("llamadas a Airtable", () => {
  it("cada llamada del cliente se cuenta en su base y workspace", async () => {
    const contador = crearContador();
    const cliente = crearCliente({ token: "token-de-prueba", fetch: respuestaVacia, alLlamar: contador.contar, msEntreLlamadas: 0 });
    await cliente.todos(TABLAS.trazabilidadVerse.idBase, TABLAS.trazabilidadVerse.idTabla);
    await cliente.todos(TABLAS.unidadesLiving.idBase, TABLAS.unidadesLiving.idTabla);
    expect(contador.total()).toBe(2);
    expect(contador.porWorkspace()).toEqual({ Verse: 2 });
  });

  it("sabe a qué workspace pertenece cada base del catálogo", () => {
    expect(workspaceDe("appFMA4kYBSCNxSFl")).toBe("C&C"); // 1. C&C GROUP
    expect(workspaceDe(TABLAS.trazabilidadCyC.idBase)).toBe("Verse"); // vive en 9. VERSE OS
    expect(workspaceDe("appNOEXISTE000000")).toBe("Desconocido");
  });

  it("suma al día de Bogotá sin perder llamadas entre corridas", async () => {
    const db = await dbDePrueba();
    const fecha = new Date("2026-11-23T03:00:00Z"); // 22 de noviembre en Bogotá
    for (let i = 0; i < 2; i++) {
      const c = crearContador();
      c.contar("appFMA4kYBSCNxSFl");
      c.contar("appFMA4kYBSCNxSFl");
      await c.volcar(db, fecha);
    }
    const filas = await db.select().from(llamadasAirtable);
    expect(filas).toEqual([{ dia: "2026-11-22", workspace: "C&C", idBase: "appFMA4kYBSCNxSFl", llamadas: 4 }]);
    expect(diaBogota(fecha)).toBe("2026-11-22");
  });
});

describe("costo de Neon", () => {
  it("calcula cómputo y almacenamiento con los precios del plan Launch", () => {
    const c = calcularCosto({ compute_time_seconds: 36_000, synthetic_storage_size: 2 * 1024 ** 3 });
    expect(c).toMatchObject({ horasComputo: 10, gbAlmacenamiento: 2, usdComputo: 1.06, usdAlmacenamiento: 0.7, usdTotal: 1.76 });
  });

  it("lee el proyecto de Neon y guarda una foto por día", async () => {
    const f = async (url: string | URL | Request) => {
      expect(String(url)).toContain("/projects/proyecto-prueba");
      return new Response(JSON.stringify({ project: { compute_time_seconds: 7200, synthetic_storage_size: 0, consumption_period_start: "2026-11-01T00:00:00Z" } }));
    };
    const costo = await leerCostoNeon({ apiKey: "clave-de-prueba", idProyecto: "proyecto-prueba" }, f as typeof fetch);
    expect(costo.usdTotal).toBe(0.21);

    const db = await dbDePrueba();
    await guardarCostoNeon(db, costo, new Date("2026-11-22T12:00:00Z"));
    await guardarCostoNeon(db, { ...costo, usdTotal: 0.3 }, new Date("2026-11-22T13:00:00Z"));
    const filas = await db.select().from(costosNeon);
    expect(filas).toHaveLength(1);
    expect(filas[0]?.usdTotal).toBe(0.3);
  });

  it("un error de Neon no expone la clave", async () => {
    const f = async () => new Response("no", { status: 401 });
    await expect(leerCostoNeon({ apiKey: "clave-secreta", idProyecto: "p" }, f as typeof fetch)).rejects.toThrow("Neon respondió 401");
  });
});
