import { describe, expect, it } from "vitest";
import { respaldos, respaldoTareas } from "@/db/esquema";
import type { FilaCatalogo } from "@/lib/airtable/construir-mapeo";
import { crearAcceso } from "@/lib/google/acceso";
import { crearDrive } from "@/lib/google/drive";
import { aplicarRetencion, prepararDia, procesarDia } from "@/lib/respaldo/correr";
import { exportarTabla } from "@/lib/respaldo/exportar";
import { carpetasAVencer, tablasDelDia } from "@/lib/respaldo/plan";
import { AirtableFalso } from "../apoyo/airtable-falso";
import { dbDePrueba } from "../apoyo/db";
import { DriveFalso } from "../apoyo/drive-falso";

const fila = (p: Partial<FilaCatalogo>): FilaCatalogo => ({
  tabla: "TAREAS",
  workspace: "Verse",
  base: "BASE PRUEBA",
  idBase: "appAAAAAAAAAAAAAA",
  idTabla: "tblAAAAAAAAAAAAAA",
  origen: "Propia",
  uso: "Manual",
  ...p,
});

describe("plan del respaldo", () => {
  const catalogo = [
    fila({}),
    fila({ tabla: "VIEJA", idTabla: "tblBBBBBBBBBBBBBB", uso: "Histórica" }),
    fila({ base: "FELIPE", idBase: "appCCCCCCCCCCCCCC" }),
    fila({ base: "5. VENTAS 54-47", idBase: "appDDDDDDDDDDDDDD" }),
    fila({ base: "6. OTROS", idBase: "appEEEEEEEEEEEEEE" }),
  ];

  it("deja fuera FELIPE, 5. VENTAS 54-47 y 6. OTROS", () => {
    expect(tablasDelDia(catalogo, "2026-11-22").map((f) => f.tabla)).toEqual(["TAREAS"]);
  });

  it("las tablas Histórica solo entran el día 1", () => {
    expect(tablasDelDia(catalogo, "2026-12-01").map((f) => f.tabla)).toEqual(["TAREAS", "VIEJA"]);
  });

  it("conserva 30 diarios y el día 1 de 12 meses", () => {
    const fechas: string[] = [];
    for (let d = new Date("2025-01-01T12:00:00Z"); d <= new Date("2026-11-22T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
      fechas.push(d.toISOString().slice(0, 10));
    }
    const vencen = new Set(carpetasAVencer([...fechas, "otra-carpeta"]));
    const quedan = fechas.filter((f) => !vencen.has(f));
    expect(quedan.filter((f) => !f.endsWith("-01") || f >= "2026-10-24")).toHaveLength(30);
    expect(quedan.filter((f) => f.endsWith("-01"))).toEqual(
      ["2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"],
    );
    expect(vencen.has("otra-carpeta")).toBe(false);
  });
});

describe("exportación", () => {
  it("CSV legible por nombre de campo, con comillas y BOM; JSON fiel por ID", () => {
    const esquema = {
      id: "tblAAAAAAAAAAAAAA",
      name: "TAREAS",
      fields: [
        { id: "fldA", name: "Asunto", type: "singleLineText" },
        { id: "fldB", name: "Etiquetas", type: "multipleSelects" },
      ],
    };
    const r = exportarTabla(esquema, [{ id: "rec1", createdTime: "2026-11-01T00:00:00Z", fields: { fldA: 'Dice "hola", y más', fldB: ["Uno", "Dos"] } }], { fecha: "2026-11-22" });
    expect(r.csv.startsWith("﻿recId,creado,Asunto,Etiquetas\r\n")).toBe(true);
    expect(r.csv).toContain('rec1,2026-11-01T00:00:00Z,"Dice ""hola"", y más",Uno; Dos');
    expect(JSON.parse(r.json).registros[0].fields.fldA).toBe('Dice "hola", y más');
  });
});

describe("acceso a Google sin claves", () => {
  it("cambia el token de Vercel por uno de la cuenta de servicio y lo reutiliza", async () => {
    const llamadas: string[] = [];
    const f = async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      llamadas.push(u);
      if (u.includes("sts.googleapis.com")) {
        const cuerpo = JSON.parse(String(init?.body));
        expect(cuerpo.subjectToken).toBe("oidc-de-prueba");
        expect(cuerpo.audience).toContain("/projects/123/locations/global/workloadIdentityPools/vercel/providers/vercel");
        return Response.json({ access_token: "federado" });
      }
      expect(u).toContain("verse-respaldos%40prueba.iam.gserviceaccount.com:generateAccessToken");
      return Response.json({ accessToken: "token-drive", expireTime: new Date(Date.now() + 3600_000).toISOString() });
    };
    const token = crearAcceso({
      config: { numeroProyecto: "123", pool: "vercel", proveedor: "vercel", cuentaServicio: "verse-respaldos@prueba.iam.gserviceaccount.com" },
      tokenOidc: async () => "oidc-de-prueba",
      fetch: f as typeof fetch,
    });
    expect(await token()).toBe("token-drive");
    expect(await token()).toBe("token-drive");
    expect(llamadas).toHaveLength(2);
  });

  it("incluye el motivo de Google cuando no deja actuar como la cuenta", async () => {
    const f = async (url: string | URL | Request) =>
      String(url).includes("sts.")
        ? Response.json({ access_token: "federado" })
        : Response.json({ error: { message: "Permission 'iam.serviceAccounts.getAccessToken' denied" } }, { status: 403 });
    const token = crearAcceso({
      config: { numeroProyecto: "1", pool: "vercel", proveedor: "vercel", cuentaServicio: "x@y.z" },
      tokenOidc: async () => "t",
      fetch: f as typeof fetch,
    });
    await expect(token()).rejects.toThrow("(403): Permission 'iam.serviceAccounts.getAccessToken' denied");
  });

  it("explica qué revisar si Google rechaza el token de Vercel", async () => {
    const token = crearAcceso({
      config: { numeroProyecto: "1", pool: "vercel", proveedor: "vercel", cuentaServicio: "x@y.z" },
      tokenOidc: async () => "t",
      fetch: (async () => new Response("no", { status: 400 })) as typeof fetch,
    });
    await expect(token()).rejects.toThrow(/pool vercel y el OIDC de Vercel/);
  });
});

describe("cliente de Drive", () => {
  it("reutiliza una carpeta existente y sube por sesión reanudable dentro de la unidad", async () => {
    const pedidos: { url: string; metodo: string }[] = [];
    const f = async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      pedidos.push({ url: u, metodo: init?.method ?? "GET" });
      if (u.includes("/drive/v3/files?q=")) return Response.json({ files: [{ id: "existe", name: "2026-11-22" }] });
      if (u.includes("uploadType=resumable")) return new Response(null, { status: 200, headers: { location: "https://subida/123" } });
      if (u === "https://subida/123") return Response.json({ id: "nuevo" });
      return new Response("no", { status: 404 });
    };
    const drive = crearDrive({ token: async () => "t", idUnidad: "unidad1", fetch: f as typeof fetch });
    expect(await drive.carpeta("2026-11-22", "unidad1")).toBe("existe");
    expect(await drive.subir("TAREAS.json", "existe", "{}", "application/json")).toBe("nuevo");
    expect(pedidos[0]?.url).toContain("driveId=unidad1");
    expect(pedidos.map((p) => p.metodo)).toEqual(["GET", "POST", "PUT"]);
  });
});

describe("subida por flujo", () => {
  it("abre la sesión con el tamaño y manda el archivo como flujo", async () => {
    let cuerpo = "";
    let inicio: Headers | undefined;
    const f = async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("uploadType=resumable")) {
        inicio = new Headers(init?.headers);
        return new Response(null, { headers: { location: "https://subida/9" } });
      }
      cuerpo = await new Response(init?.body as ReadableStream).text();
      return Response.json({ id: "video1" });
    };
    const drive = crearDrive({ token: async () => "t", idUnidad: "u", fetch: f as typeof fetch });
    const flujo = new Response("contenido-largo").body!;
    expect(await drive.subirFlujo("aseo.mp4", "c", flujo, "video/mp4", 15)).toBe("video1");
    expect(inicio?.get("x-upload-content-length")).toBe("15");
    expect(cuerpo).toBe("contenido-largo");
  });
});

describe("corrida del respaldo", () => {
  const catalogo = [fila({}), fila({ tabla: "OTRA", idTabla: "tblBBBBBBBBBBBBBB" })];

  function airtableConDatos() {
    const at = new AirtableFalso();
    at.esquemas.set("appAAAAAAAAAAAAAA", [
      { id: "tblAAAAAAAAAAAAAA", name: "TAREAS", fields: [{ id: "fldA", name: "Asunto", type: "singleLineText" }] },
      { id: "tblBBBBBBBBBBBBBB", name: "OTRA", fields: [{ id: "fldB", name: "Nombre", type: "singleLineText" }] },
    ]);
    at.poner("appAAAAAAAAAAAAAA", "tblAAAAAAAAAAAAAA", { fldA: "Tarea de prueba" });
    at.poner("appAAAAAAAAAAAAAA", "tblBBBBBBBBBBBBBB", { fldB: "Fila de prueba" });
    return at;
  }

  it("respalda cada tabla en JSON y CSV en fecha/base/tabla y cierra el día", async () => {
    const db = await dbDePrueba();
    const drive = new DriveFalso();
    expect(await prepararDia(db, "2026-11-22", catalogo)).toBe(2);
    expect(await prepararDia(db, "2026-11-22", catalogo)).toBe(2);
    expect(await db.select().from(respaldoTareas)).toHaveLength(2);

    const r = await procesarDia({ db, airtable: airtableConDatos(), drive, idUnidad: "unidad" }, "2026-11-22", 60_000);
    expect(r).toEqual({ hechas: 2, fallidas: 0, pendientes: 0, adjuntosGuardados: 0, adjuntosPendientes: 0, terminado: true });

    const rutas = drive.archivos.map((a) => `${drive.ruta(a.padre)}/${a.name}`);
    expect(rutas).toContain("unidad/2026-11-22/BASE PRUEBA/TAREAS.json");
    expect(rutas).toContain("unidad/2026-11-22/BASE PRUEBA/OTRA.csv");
    expect(rutas).toContain("unidad/2026-11-22/_app/auditoria.json");
    const estado = drive.archivos.find((a) => a.name === "sync_estado.json");
    expect(estado?.contenido).not.toContain("webhookMac");

    const [dia] = await db.select().from(respaldos);
    expect(dia).toMatchObject({ estado: "completo", hechas: 2, filas: 2, fallidas: 0 });
  });

  it("si se acaba el tiempo deja pendientes para la siguiente vuelta", async () => {
    const db = await dbDePrueba();
    await prepararDia(db, "2026-11-22", catalogo);
    let t = 0;
    const r = await procesarDia({ db, airtable: airtableConDatos(), drive: new DriveFalso(), idUnidad: "u", ahora: () => (t += 1000) }, "2026-11-22", 1500);
    expect(r).toMatchObject({ hechas: 1, pendientes: 1, terminado: false });
  });

  it("reintenta una tabla que falla y la marca fallida al tercer intento", async () => {
    const db = await dbDePrueba();
    const drive = new DriveFalso();
    drive.fallarSubida = "OTRA";
    await prepararDia(db, "2026-11-22", catalogo);
    const r = await procesarDia({ db, airtable: airtableConDatos(), drive, idUnidad: "u" }, "2026-11-22", 60_000);
    expect(r).toMatchObject({ hechas: 1, fallidas: 1, terminado: true });
    const [dia] = await db.select().from(respaldos);
    expect(dia?.estado).toBe("con_fallas");
  });

  it("la retención manda a la papelera solo carpetas de fecha vencidas", async () => {
    const drive = new DriveFalso();
    for (let i = 1; i <= 31; i++) await drive.carpeta(`2026-10-${String(i).padStart(2, "0")}`, "u");
    await drive.carpeta("Notas de Felipe", "u");
    const vencidas = await aplicarRetencion(drive, "u");
    expect(vencidas).toEqual([]);
    for (let i = 1; i <= 5; i++) await drive.carpeta(`2026-11-${String(i).padStart(2, "0")}`, "u");
    expect((await aplicarRetencion(drive, "u")).sort()).toEqual(["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]);
  });
});
