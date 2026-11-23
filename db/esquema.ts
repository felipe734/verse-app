import { sql } from "drizzle-orm";
import type { Casillas } from "../lib/acceso/casillas";
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
  uniqueIndex,
  uuid,
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
    linea: text(),
    creado: timestamp({ withTimezone: true }),
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
  adjuntos: integer().notNull().default(0),
  bytesAdjuntos: doublePrecision("bytes_adjuntos").notNull().default(0),
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

/** Cada adjunto de Airtable se guarda una vez en Drive; los enlaces de Airtable vencen en horas. */
export const respaldoAdjuntos = pgTable(
  "respaldo_adjuntos",
  {
    idAdjunto: text("id_adjunto").primaryKey(),
    idBase: text("id_base").notNull(),
    idTabla: text("id_tabla").notNull(),
    base: text().notNull(),
    tabla: text().notNull(),
    recId: text("rec_id").notNull(),
    idCampo: text("id_campo").notNull(),
    nombre: text().notNull(),
    tipo: text(),
    bytes: doublePrecision(),
    url: text().notNull(),
    urlTomada: timestamp("url_tomada", { withTimezone: true }).notNull().defaultNow(),
    estado: text().$type<"pendiente" | "guardado" | "fallido">().notNull().default("pendiente"),
    intentos: integer().notNull().default(0),
    idDrive: text("id_drive"),
    error: text(),
    guardado: timestamp({ withTimezone: true }),
  },
  (t) => [index("adjuntos_pendientes").on(t.estado)],
);

/** Empresas de la app (no son workspaces de Airtable). Editables desde Ajustes. */
export const empresas = pgTable("empresas", {
  id: text().primaryKey(),
  nombre: text().notNull(),
  orden: integer().notNull().default(0),
  cuentas: jsonb().$type<{ id: string; nombre: string }[]>().notNull().default([]),
  /** Lo único que cambia por empresa en la interfaz: color de acento y logo. */
  acento: text().notNull().default("#18181b"),
  logo: text(),
  creado: ahora(),
});

export const verticales = pgTable("verticales", {
  id: text().primaryKey(),
  empresaId: text("empresa_id").notNull().references(() => empresas.id),
  nombre: text().notNull(),
  orden: integer().notNull().default(0),
});

export const modulos = pgTable("modulos", {
  id: text().primaryKey(),
  verticalId: text("vertical_id").notNull().references(() => verticales.id),
  nombre: text().notNull(),
  descripcion: text().notNull().default(""),
  /** Tipo de pantalla del registro de módulos; vacío = sin pantalla todavía. */
  tipo: text().notNull().default(""),
  orden: integer().notNull().default(0),
});

export const plantillas = pgTable("plantillas", {
  id: text().primaryKey(),
  empresaId: text("empresa_id").notNull().references(() => empresas.id),
  nombre: text().notNull(),
  casillas: jsonb().$type<Casillas>().notNull(),
});

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid().primaryKey().defaultRandom(),
    nombre: text().notNull(),
    /** Correo de Google, en minúsculas. */
    correo: text().notNull(),
    celular: text(),
    estado: text().$type<"invitado" | "activo" | "suspendido">().notNull().default("invitado"),
    maestro: boolean().notNull().default(false),
    nombreAirtable: text("nombre_airtable"),
    creado: ahora(),
    ultimoIngreso: timestamp("ultimo_ingreso", { withTimezone: true }),
  },
  (t) => [uniqueIndex("usuarios_correo").on(t.correo)],
);

/** Usuario × empresa, con sus casillas. */
export const accesos = pgTable(
  "accesos",
  {
    usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
    empresaId: text("empresa_id").notNull().references(() => empresas.id),
    plantillaId: text("plantilla_id").references(() => plantillas.id),
    casillas: jsonb().$type<Casillas>().notNull(),
    actualizado: ahora(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.empresaId] })],
);

export const invitaciones = pgTable("invitaciones", {
  /** Solo se guarda el hash del enlace. */
  hash: text().primaryKey(),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  vence: timestamp({ withTimezone: true }).notNull(),
  usada: timestamp({ withTimezone: true }),
  creado: ahora(),
});

/** Dispositivos donde cada persona activó los avisos (Web Push). */
export const suscripcionesPush = pgTable(
  "suscripciones_push",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    creado: ahora(),
    ultimoEnvio: timestamp("ultimo_envio", { withTimezone: true }),
    activa: boolean().notNull().default(true),
  },
  (t) => [uniqueIndex("suscripciones_endpoint").on(t.endpoint)],
);

/** Cada aviso sale una sola vez por fila y motivo. */
export const avisos = pgTable("avisos", {
  clave: text().primaryKey(),
  tipo: text().$type<"critico" | "aprobar" | "falla">().notNull(),
  recId: text("rec_id"),
  destinatarios: integer().notNull().default(0),
  enviados: integer().notNull().default(0),
  /** true = registrado sin enviar (no había claves VAPID). */
  sembrado: boolean().notNull().default(false),
  creado: ahora(),
});

/** Conversaciones con el asistente, una por persona y hilo. */
export const conversaciones = pgTable("conversaciones", {
  id: uuid().primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  creado: ahora(),
  actualizado: ahora(),
});

/** Cada mensaje del asistente con sus tokens y su costo (se ve en Sistema). */
export const mensajesAsistente = pgTable(
  "mensajes_asistente",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    conversacionId: uuid("conversacion_id").notNull().references(() => conversaciones.id),
    rol: text().$type<"user" | "assistant">().notNull(),
    /** Contenido tal como lo devuelve la API (bloques), para reenviarlo sin cambios. */
    contenido: jsonb().$type<unknown>().notNull(),
    modelo: text(),
    tokensEntrada: integer("tokens_entrada").notNull().default(0),
    tokensSalida: integer("tokens_salida").notNull().default(0),
    tokensCacheLeidos: integer("tokens_cache_leidos").notNull().default(0),
    tokensCacheEscritos: integer("tokens_cache_escritos").notNull().default(0),
    costoUsd: doublePrecision("costo_usd").notNull().default(0),
    creado: ahora(),
  },
  (t) => [index("mensajes_conversacion").on(t.conversacionId, t.id)],
);

/** Lo irreversible que propone el asistente: solo se ejecuta cuando la persona confirma. */
export const propuestas = pgTable("propuestas", {
  id: uuid().primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id),
  conversacionId: uuid("conversacion_id").references(() => conversaciones.id),
  tipo: text().notNull(),
  datos: jsonb().$type<Record<string, unknown>>().notNull(),
  resumen: text().notNull(),
  estado: text().$type<"pendiente" | "hecha" | "rechazada" | "fallida">().notNull().default("pendiente"),
  resultado: text(),
  creado: ahora(),
});
