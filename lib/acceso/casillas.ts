import { z } from "zod";

/**
 * Casillas de un acceso (doc del plan, "Usuarios y permisos"). Un acceso es usuario × empresa.
 * Todo lo que no está marcado es "sin acceso".
 */
export const NivelModulo = z.enum(["sin", "ver", "editar"]);
export const NivelCorreo = z.enum(["sin", "leer", "redactar", "enviar"]);
export const NivelCodigos = z.enum(["nunca", "turno", "siempre"]);
export const NivelAsistente = z.enum(["no", "consultas", "acciones"]);

export const Casillas = z.object({
  /** Por módulo. */
  modulos: z.record(z.string(), NivelModulo).default({}),
  /** Por empresa: "suyo" = solo filas donde Responsable es la persona. */
  alcanceHoy: z.enum(["todo", "suyo"]).default("suyo"),
  aprobar: z.boolean().default(false),
  /** Por cuenta de correo. */
  correo: z.record(z.string(), NivelCorreo).default({}),
  /** Por vertical: sin la casilla, los montos no salen del servidor. */
  cifras: z.record(z.string(), z.boolean()).default({}),
  /** Por vertical. */
  codigos: z.record(z.string(), NivelCodigos).default({}),
  /** Por vertical: teléfonos, documentos, cuentas. */
  terceros: z.record(z.string(), z.boolean()).default({}),
  descargar: z.boolean().default(false),
  asistente: NivelAsistente.default("no"),
});

export type Casillas = z.infer<typeof Casillas>;
export type NivelModulo = z.infer<typeof NivelModulo>;

export const casillasVacias = (): Casillas => Casillas.parse({});
