/**
 * Genera lib/airtable/mapeo.ts desde el CATÁLOGO DE DATOS y los esquemas vivos.
 * Uso: AIRTABLE_TOKEN=... pnpm mapeo:generar
 *      pnpm mapeo:generar --desde instantanea.json   (sin red, para pruebas)
 * Solo lee de Airtable.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { crearCliente } from "../lib/airtable/cliente";
import {
  construirMapeo,
  escribirModulo,
  type EsquemasPorBase,
  type FilaCatalogo,
  type Workspace,
} from "../lib/airtable/construir-mapeo";
import { ARRANQUE_CATALOGO, TABLAS_SINCRONIZADAS } from "../lib/airtable/definicion";

interface Instantanea {
  catalogo: FilaCatalogo[];
  esquemas: EsquemasPorBase;
}

function texto(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && "name" in v) return String((v as { name: unknown }).name).trim();
  return "";
}

async function leerEnVivo(token: string): Promise<Instantanea> {
  const cliente = crearCliente({ token });
  const { idBase, idTabla, campos } = ARRANQUE_CATALOGO;
  const filas = await cliente.todos(idBase, idTabla, { returnFieldsByFieldId: "false" });
  const catalogo: FilaCatalogo[] = filas
    .map((r) => ({
      tabla: texto(r.fields[campos.tabla]),
      workspace: texto(r.fields[campos.workspace]) as Workspace,
      base: texto(r.fields[campos.base]),
      idBase: texto(r.fields[campos.idBase]),
      idTabla: texto(r.fields[campos.idTabla]),
      origen: texto(r.fields[campos.origen]),
      uso: texto(r.fields[campos.uso]),
    }))
    .filter((f) => f.tabla && f.idBase && f.idTabla);

  const bases = new Set<string>();
  for (const def of Object.values(TABLAS_SINCRONIZADAS)) {
    const fila = catalogo.find((f) => f.base === def.base && f.tabla === def.tabla);
    if (fila) bases.add(fila.idBase);
  }
  const esquemas: EsquemasPorBase = {};
  for (const id of bases) esquemas[id] = await cliente.esquema(id);
  return { catalogo, esquemas };
}

async function main() {
  const i = process.argv.indexOf("--desde");
  let datos: Instantanea;
  if (i > -1) {
    const ruta = process.argv[i + 1];
    if (!ruta) throw new Error("Falta la ruta después de --desde");
    datos = JSON.parse(readFileSync(resolve(ruta), "utf8")) as Instantanea;
  } else {
    const token = process.env.AIRTABLE_TOKEN;
    if (!token) throw new Error("Falta la variable AIRTABLE_TOKEN.");
    datos = await leerEnVivo(token);
  }
  const mapeo = construirMapeo(datos.catalogo, datos.esquemas);
  const fecha = new Date().toISOString().slice(0, 10);
  writeFileSync(resolve("lib/airtable/mapeo.ts"), escribirModulo(mapeo, fecha));
  console.log(`mapeo.ts: ${mapeo.catalogo.length} tablas en catálogo, ${Object.keys(mapeo.tablas).length} sincronizadas`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
