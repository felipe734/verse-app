/**
 * Qué sincroniza la app y qué campos usa, por NOMBRE.
 * Los IDs salen de `pnpm mapeo:generar`, que los resuelve contra el CATÁLOGO DE DATOS
 * y los esquemas vivos de Airtable y escribe `mapeo.ts`. Nunca se escriben IDs a mano,
 * salvo el punto de arranque: dónde vive el catálogo.
 */

export const ARRANQUE_CATALOGO = {
  idBase: "appylcO9bGU5EBgV2", // 9. VERSE OS
  idTabla: "tblcgwxzsvThSkAjW", // CATÁLOGO DE DATOS
  campos: {
    tabla: "Tabla",
    workspace: "Workspace",
    base: "Base",
    idBase: "ID base",
    idTabla: "ID tabla",
    origen: "Origen",
    uso: "Uso",
  },
} as const;

export interface TablaDefinida {
  /** Nombre de la base como aparece en el catálogo (campo Base). */
  base: string;
  /** Nombre de la tabla como aparece en el catálogo (campo Tabla). */
  tabla: string;
  /** Claves de la app → nombre del campo en Airtable. */
  campos: Record<string, string>;
}

export const TABLAS_SINCRONIZADAS = {
  trazabilidadVerse: {
    base: "9. VERSE OS",
    tabla: "TRAZABILIDAD VERSE",
    campos: {
      id: "ID",
      asunto: "Asunto",
      tipo: "Tipo",
      proceso: "Proceso",
      area: "Área",
      estado: "Estado",
      plazo: "Plazo",
      responsable: "Responsable",
      fechaLimite: "Fecha límite",
      mes: "Mes",
      linea: "Línea",
      detalle: "Detalle",
      corrida: "Corrida",
      pendientesGenerados: "Pendientes generados",
      link: "Link",
      refExterna: "Ref externa",
      falta: "Falta",
      creado: "Creado",
    },
  },
  trazabilidadCyC: {
    base: "9. VERSE OS",
    tabla: "TRAZABILIDAD C&C",
    campos: {
      id: "ID",
      asunto: "Asunto",
      tipo: "Tipo",
      proceso: "Proceso",
      estado: "Estado",
      plazo: "Plazo",
      responsable: "Responsable",
      fechaLimite: "Fecha límite",
      mes: "Mes",
      linea: "Línea",
      detalle: "Detalle",
      corrida: "Corrida",
      pendientesGenerados: "Pendientes generados",
      link: "Link",
      refExterna: "Ref externa",
      falta: "Falta",
      creado: "Creado",
    },
  },
  unidadesHost: {
    base: "5. INVENTARIO",
    tabla: "UNIDADES",
    campos: {
      und: "UND",
      unidad: "Unidad",
      estado: "Estado",
      edificio: "Edificio",
      ciudad: "Ciudad",
      producto: "Producto",
      tipoServicio: "Tipo Servicio",
      propietario: "Propietario",
      funcionaria: "Funcionaria",
    },
  },
  unidadesLiving: {
    base: "7. LIVING",
    tabla: "UNIDADES",
    campos: {
      unidad: "Unidad",
      estado: "Estado",
      fechaSalida: "Fecha Salida",
      renovacion: "Renovación",
      webProducto: "Web · Producto",
    },
  },
} as const satisfies Record<string, TablaDefinida>;

export type ClaveTabla = keyof typeof TABLAS_SINCRONIZADAS;

/** Bases fuera del alcance de la app (doc del plan). El token de Airtable no las incluye. */
export const BASES_FUERA_DE_LA_APP = ["FELIPE", "5. VENTAS 54-47", "6. OTROS"] as const;

export function estaEnLaApp(base: string): boolean {
  return !(BASES_FUERA_DE_LA_APP as readonly string[]).includes(base);
}
