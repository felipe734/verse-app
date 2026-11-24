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
  // Copias para leer sin ir a Airtable (alertas, Inicio). Solo los campos que se leen de la copia.
  reservasHost: {
    base: "6. OPERACION 360",
    tabla: "RESERVAS",
    campos: { unidad: "Unidad", ingreso: "Ingreso", salida: "Salida" },
  },
  limpiezasHost: {
    base: "6. OPERACION 360",
    tabla: "LIMPIEZA",
    campos: { unidad: "Unidad", fecha: "Fecha", funcionario: "Funcionario" },
  },
  ingresosLivingCopia: {
    base: "7. LIVING",
    tabla: "INGRESOS",
    campos: { unidad: "Unidad", fecha: "Fecha", estado: "Estado" },
  },
  /** Nombres de las unidades a las que apuntan RESERVAS y LIMPIEZA. Solo de noche, sin webhook. */
  unidadesOperacionCopia: {
    base: "6. OPERACION 360",
    tabla: "UNIDADES",
    campos: { unidad: "Unidad", edificio: "Edificio" },
  },
} as const satisfies Record<string, TablaDefinida>;

export type ClaveTabla = keyof typeof TABLAS_SINCRONIZADAS;

/**
 * Tablas donde la app escribe sin copiarlas a Postgres (se leen en el momento). Entran al
 * mapeo para tener los IDs de campo, pero no al sincronizador.
 */
export const TABLAS_ESCRITURA = {
  tickets: {
    base: "6. OPERACION 360",
    tabla: "TICKETS",
    campos: {
      titulo: "Título",
      unidad: "Unidad",
      tipo: "Tipo",
      prioridad: "Prioridad",
      estado: "Estado",
      responsable: "Responsable",
      fechaLimite: "Fecha límite",
      origen: "Origen",
      evidencia: "Evidencia",
      comentario: "Comentario",
      cerradoEl: "Cerrado el",
      creadoPor: "Creado por",
    },
  },
  funcionarias: {
    base: "6. OPERACION 360",
    tabla: "FUNCIONARIAS",
    campos: {
      nombre: "Nombre",
      activa: "Activa",
      correo: "Correo",
      nombreLimpieza: "Nombre en LIMPIEZA",
      nombreServicios: "Nombre en SERVICIOS",
      nombreHoras: "Nombre en CONTROL HORAS",
    },
  },
  limpieza: {
    base: "6. OPERACION 360",
    tabla: "LIMPIEZA",
    campos: {
      id: "ID",
      unidad: "Unidad",
      funcionario: "Funcionario",
      funcionaria: "Funcionaria enlace",
      estado: "Estado",
      fecha: "Fecha",
      comentario: "Comentario",
      total: "Total",
      estadoPago: "Estado Pago",
    },
  },
  servicios: {
    base: "6. OPERACION 360",
    tabla: "SERVICIOS",
    campos: {
      unidad: "Unidad",
      tipo: "Tipo",
      fechaHora: "Fecha - Hora",
      funcionario: "Funcionario",
      funcionaria: "Funcionaria enlace",
      video: "Video",
      estado: "Estado",
      danos: "Daños | Faltantes",
      comentario: "Comentario",
      necesitaImplementos: "¿Se necesitan implementos para el próximo servicio?",
      implementosComprar: "Implementos a comprar",
      lavanderia: "Lavandería",
    },
  },
  controlHoras: {
    base: "6. OPERACION 360",
    tabla: "CONTROL HORAS",
    campos: {
      funcionaria: "Funcionaria",
      funcionariaEnlace: "Funcionaria enlace",
      ingreso: "Ingreso",
      salida: "Salida",
      notas: "Notas",
      validado: "Validado",
    },
  },
  unidadesOperacion: {
    base: "6. OPERACION 360",
    tabla: "UNIDADES",
    campos: {
      und: "UND",
      unidad: "Unidad",
      edificio: "Edificio",
      estado: "Estado",
      producto: "Producto",
      valorLimpieza: "Valor Limpieza",
      metodo: "Metodo Ingreso",
      codigo: "Codigo",
      candado: "Candado",
      wifiRed: "WIFI Red",
      wifiClave: "WIFI Contraseña",
    },
  },
  reservas: {
    base: "6. OPERACION 360",
    tabla: "RESERVAS",
    campos: { novedades: "NOVEDADES", comentario: "Comentario", requiereLimpieza: "Requiere Limpieza" },
  },
  fCortas: {
    base: "6. OPERACION 360",
    tabla: "F_CORTAS",
    campos: { estado: "Estado", comentario: "Comentario" },
  },
  proyAmob: {
    base: "8. ALISTAMIENTO",
    tabla: "PROY_AMOB",
    campos: { estadoPedido: "Estado Pedido" },
  },
  leadsHost: {
    base: "10. LEAD GEN",
    tabla: "LEADS",
    campos: { estado: "Estado" },
  },
  contratos: {
    base: "7. LIVING",
    tabla: "CONTRATO",
    campos: { estado: "Estado" },
  },
  ingresosLiving: {
    base: "7. LIVING",
    tabla: "INGRESOS",
    campos: { estado: "Estado" },
  },
  actas: {
    base: "11. ACTAS OBRA",
    tabla: "ACTAS",
    campos: { estado: "Estado" },
  },
  contabilidadObra: {
    base: "12. EDIFICIO 54-47",
    tabla: "CONTABILIDAD",
    campos: { estado: "Estado" },
  },
  movimientos: {
    base: "1. VL PRIVADO",
    tabla: "MOVIMIENTOS",
    campos: { estado: "Estado", categoria: "Categoría", comentario: "Comentario" },
  },
  cajaVerse: {
    base: "3. ADMIN",
    tabla: "CAJA MENOR VERSE",
    campos: { persona: "Persona", fecha: "Fecha", apto: "Apto", concepto: "Concepto", valor: "Valor", foto: "Foto" },
  },
  cajaCyC: {
    base: "4. CAJA MENOR",
    tabla: "MOVIMIENTOS C&C",
    campos: {
      concepto: "Concepto",
      fecha: "Fecha",
      tipo: "Tipo",
      tercero: "Tercero",
      nit: "NIT / CC",
      egreso: "Egreso",
      soporte: "Soporte",
      tipoSoporte: "Tipo Soporte",
      comentario: "Comentario",
      responsable: "Responsable",
    },
  },
} as const satisfies Record<string, TablaDefinida>;

export type ClaveEscritura = keyof typeof TABLAS_ESCRITURA;

/** Bases fuera del alcance de la app (doc del plan). El token de Airtable no las incluye. */
export const BASES_FUERA_DE_LA_APP = ["FELIPE", "5. VENTAS 54-47", "6. OTROS"] as const;

export function estaEnLaApp(base: string): boolean {
  return !(BASES_FUERA_DE_LA_APP as readonly string[]).includes(base);
}
