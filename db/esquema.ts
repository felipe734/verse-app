import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const ahora = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/** Copia fiel de cada fila sincronizada. `campos` va por ID de campo. */
export const registros = pgTable(
  "registros",
  {
    idBase: text("id_base").notNull(),
    idTabla: text("id_tabla").notNull(),
    recId: text("rec_id").notNull(),
    campos: jsonb().$type<Record<string, unknown>>().notNull(),
    huella: text().notNull(),
    creadoEnAirtable: timestamp("creado_en_airtable", { withTimezone: true }).notNull(),
    actualizado: ahora(),
  },
  (t) => [primaryKey({ columns: [t.idBase, t.idTabla, t.recId] })],
);

/** TRAZABILIDAD Verse y C&C en un solo modelo. */
export const tareas = pgTable(
  "tareas",
  {
    recId: text("rec_id").primaryKey(),
    empresa: text().$type<"Verse" | "C&C">().notNull(),
    numero: integer(),
    tipo: text(),
    asunto: text(),
    proceso: text(),
    estado: text(),
    responsable: text(),
    fechaLimite: date("fecha_limite"),
    detalle: text(),
    link: text(),
    corrida: text().array().notNull().default(sql`'{}'::text[]`),
    actualizado: ahora(),
  },
  (t) => [index("tareas_empresa_estado").on(t.empresa, t.estado)],
);

/** Unidades de 5. INVENTARIO (Host) y 7. LIVING. */
export const unidades = pgTable("unidades", {
  recId: text("rec_id").primaryKey(),
  linea: text().$type<"Host" | "Living">().notNull(),
  unidad: text(),
  edificio: text(),
  estado: text(),
  actualizado: ahora(),
});

/** Estado de sincronización por tabla: carga, reconciliación y webhook. */
export const syncEstado = pgTable("sync_estado", {
  clave: text().primaryKey(),
  idBase: text("id_base").notNull(),
  idTabla: text("id_tabla").notNull(),
  filas: integer().notNull().default(0),
  ultimaCarga: timestamp("ultima_carga", { withTimezone: true }),
  ultimaReconciliacion: timestamp("ultima_reconciliacion", { withTimezone: true }),
  webhookId: text("webhook_id"),
  webhookMac: text("webhook_mac"),
  webhookCursor: integer("webhook_cursor").notNull().default(1),
  webhookVence: timestamp("webhook_vence", { withTimezone: true }),
  error: text(),
});

/** Una fila por tabla y noche: si la copia cuadra con Airtable fila por fila. */
export const reconciliaciones = pgTable("reconciliaciones", {
  id: bigserial({ mode: "number" }).primaryKey(),
  clave: text().notNull(),
  cuando: ahora(),
  filasAirtable: integer("filas_airtable").notNull(),
  filasCopia: integer("filas_copia").notNull(),
  faltaban: integer().notNull(),
  sobraban: integer().notNull(),
  distintas: integer().notNull(),
  cuadra: boolean().notNull(),
});

export type EstadoEscritura = "pendiente" | "enviando" | "hecha" | "fallida";

/** Escrituras hacia Airtable con autor, intentos y error. */
export const colaEscrituras = pgTable(
  "cola_escrituras",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    idBase: text("id_base").notNull(),
    idTabla: text("id_tabla").notNull(),
    recId: text("rec_id"),
    operacion: text().$type<"crear" | "actualizar">().notNull(),
    campos: jsonb().$type<Record<string, unknown>>().notNull(),
    /** Valor de los campos que el usuario vio antes de editar; si Airtable ya no lo tiene, gana Airtable. */
    esperado: jsonb().$type<Record<string, unknown>>(),
    autor: text().notNull(),
    estado: text().$type<EstadoEscritura>().notNull().default("pendiente"),
    intentos: integer().notNull().default(0),
    error: text(),
    creado: ahora(),
    proximoIntento: timestamp("proximo_intento", { withTimezone: true }).notNull().defaultNow(),
    procesado: timestamp({ withTimezone: true }),
  },
  (t) => [index("cola_pendientes").on(t.estado, t.proximoIntento)],
);

/** Quién hizo qué y cuándo, con valor antes y después. */
export const auditoria = pgTable(
  "auditoria",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    cuando: ahora(),
    autor: text().notNull(),
    accion: text().notNull(),
    idBase: text("id_base"),
    idTabla: text("id_tabla"),
    recId: text("rec_id"),
    antes: jsonb().$type<Record<string, unknown>>(),
    despues: jsonb().$type<Record<string, unknown>>(),
    detalle: text(),
  },
  (t) => [index("auditoria_registro").on(t.idTabla, t.recId)],
);

/** Llamadas HTTP a Airtable por día, workspace y base. */
export const llamadasAirtable = pgTable(
  "llamadas_airtable",
  {
    dia: date().notNull(),
    workspace: text().notNull(),
    idBase: text("id_base").notNull(),
    llamadas: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.dia, t.workspace, t.idBase] })],
);

/** Consumo de Neon del período de facturación, una foto por día. */
export const costosNeon = pgTable("costos_neon", {
  dia: date().primaryKey(),
  periodoInicio: timestamp("periodo_inicio", { withTimezone: true }),
  horasComputo: doublePrecision("horas_computo").notNull(),
  gbAlmacenamiento: doublePrecision("gb_almacenamiento").notNull(),
  usdComputo: doublePrecision("usd_computo").notNull(),
  usdAlmacenamiento: doublePrecision("usd_almacenamiento").notNull(),
  usdTotal: doublePrecision("usd_total").notNull(),
  tomado: ahora(),
});

/** Una fila por noche de respaldo. */
export const respaldos = pgTable("respaldos", {
  fecha: date().primaryKey(),
  estado: text().$type<"en_curso" | "completo" | "con_fallas">().notNull().default("en_curso"),
  carpetaId: text("carpeta_id"),
  tablas: integer().notNull().default(0),
  hechas: integer().notNull().default(0),
  fallidas: integer().notNull().default(0),
  filas: integer().notNull().default(0),
  bytes: doublePrecision().notNull().default(0),
  inicio: ahora(),
  fin: timestamp({ withTimezone: true }),
  error: text(),
});

/** Una tarea por tabla y noche; el respaldo se reparte en varias corridas. */
export const respaldoTareas = pgTable(
  "respaldo_tareas",
  {
    fecha: date().notNull(),
    idBase: text("id_base").notNull(),
    idTabla: text("id_tabla").notNull(),
    base: text().notNull(),
    tabla: text().notNull(),
    estado: text().$type<"pendiente" | "hecha" | "fallida">().notNull().default("pendiente"),
    intentos: integer().notNull().default(0),
    filas: integer(),
    bytes: integer(),
    error: text(),
    actualizado: ahora(),
  },
  (t) => [primaryKey({ columns: [t.fecha, t.idBase, t.idTabla] })],
);
