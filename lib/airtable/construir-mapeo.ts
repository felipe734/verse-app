import { TABLAS_ESCRITURA, TABLAS_SINCRONIZADAS, type TablaDefinida } from "./definicion";

export type Workspace = "Verse" | "C&C";

export interface FilaCatalogo {
  tabla: string;
  workspace: Workspace;
  base: string;
  idBase: string;
  idTabla: string;
  origen: string;
  uso: string;
}

export interface EsquemaCampo {
  id: string;
  name: string;
  type: string;
  options?: { choices?: { id?: string; name: string }[]; [k: string]: unknown };
}

export interface EsquemaTabla {
  id: string;
  name: string;
  primaryFieldId?: string;
  fields: EsquemaCampo[];
}

/** Esquemas vivos por idBase (respuesta de la Meta API de Airtable). */
export type EsquemasPorBase = Record<string, EsquemaTabla[]>;

export interface CampoMapeado {
  id: string;
  nombre: string;
  tipo: string;
}

export interface TablaMapeada {
  base: string;
  tabla: string;
  workspace: Workspace;
  idBase: string;
  idTabla: string;
  campos: Record<string, CampoMapeado>;
}

export interface Mapeo {
  catalogo: FilaCatalogo[];
  tablas: Record<string, TablaMapeada>;
  /** Tablas donde la app escribe sin sincronizarlas (TABLAS_ESCRITURA). */
  escritura?: Record<string, TablaMapeada>;
}

const PATRON_BASE = /^app[A-Za-z0-9]{14}$/;
const PATRON_TABLA = /^tbl[A-Za-z0-9]{14}$/;

export class ErrorMapeo extends Error {
  override name = "ErrorMapeo";
}

export function construirMapeo(
  catalogo: FilaCatalogo[],
  esquemas: EsquemasPorBase,
  definicion: Record<string, TablaDefinida> = TABLAS_SINCRONIZADAS,
  escritura: Record<string, TablaDefinida> = TABLAS_ESCRITURA,
): Mapeo {
  for (const fila of catalogo) {
    if (!PATRON_BASE.test(fila.idBase) || !PATRON_TABLA.test(fila.idTabla)) {
      throw new ErrorMapeo(`ID inválido en el catálogo: ${fila.base} / ${fila.tabla}`);
    }
  }

  const tablas = mapearTablas(catalogo, esquemas, definicion);
  const escrituraMapeada = mapearTablas(catalogo, esquemas, escritura);

  const ordenado = [...catalogo].sort(
    (a, b) => a.base.localeCompare(b.base, "es") || a.tabla.localeCompare(b.tabla, "es"),
  );
  return { catalogo: ordenado, tablas, ...(Object.keys(escrituraMapeada).length ? { escritura: escrituraMapeada } : {}) };
}


function mapearTablas(catalogo: FilaCatalogo[], esquemas: EsquemasPorBase, definicion: Record<string, TablaDefinida>): Record<string, TablaMapeada> {
  const tablas: Record<string, TablaMapeada> = {};
  for (const [clave, def] of Object.entries(definicion)) {
    const filas = catalogo.filter((f) => f.base === def.base && f.tabla === def.tabla);
    if (filas.length !== 1) {
      throw new ErrorMapeo(
        `${def.base} / ${def.tabla}: el catálogo tiene ${filas.length} filas, se esperaba 1`,
      );
    }
    const fila = filas[0]!;
    const esquema = esquemas[fila.idBase]?.find((t) => t.id === fila.idTabla);
    if (!esquema) {
      throw new ErrorMapeo(`${def.base} / ${def.tabla}: ${fila.idTabla} no existe en Airtable`);
    }

    const campos: Record<string, CampoMapeado> = {};
    for (const [claveCampo, nombre] of Object.entries(def.campos)) {
      const encontrados = esquema.fields.filter((c) => c.name === nombre);
      if (encontrados.length !== 1) {
        throw new ErrorMapeo(
          `${def.base} / ${def.tabla}: el campo "${nombre}" aparece ${encontrados.length} veces`,
        );
      }
      const campo = encontrados[0]!;
      campos[claveCampo] = { id: campo.id, nombre: campo.name, tipo: campo.type };
    }

    tablas[clave] = {
      base: fila.base,
      tabla: fila.tabla,
      workspace: fila.workspace,
      idBase: fila.idBase,
      idTabla: fila.idTabla,
      campos,
    };
  }

  return tablas;
}

export function escribirModulo(mapeo: Mapeo, fecha: string): string {
  return [
    "// Archivo generado por `pnpm mapeo:generar`. No editar a mano.",
    `// Fuente: CATÁLOGO DE DATOS (9. VERSE OS) y esquemas vivos de Airtable, ${fecha}.`,
    'import type { Mapeo } from "./construir-mapeo";',
    "",
    `export const MAPEO = ${JSON.stringify(mapeo, null, 2)} as const satisfies Mapeo;`,
    "",
    "export const TABLAS = MAPEO.tablas;",
    "export const CATALOGO = MAPEO.catalogo;",
    ...(mapeo.escritura ? ["export const ESCRITURA = MAPEO.escritura;"] : []),
    "",
  ].join("\n");
}
