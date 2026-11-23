import { z } from "zod";
import { nivelCorreo, puede, type Sesion } from "@/lib/acceso/permisos";
import { cuentasLegibles } from "./bandeja";
import { CUENTAS, cuentaPorId, type IdCuenta } from "./cuentas";
import { vistaPreviaCliente } from "./vista";

const Correo = z.string().trim().email().max(200);
const IDS = CUENTAS.map((c) => c.id) as [IdCuenta, ...IdCuenta[]];

export const ProponerCorreo = z.object({
  cuenta: z.enum(IDS).describe("Cuenta que envía (os-correo): se responde desde la cuenta a la que escribieron"),
  para: z.array(Correo).min(1).max(10),
  cc: z.array(Correo).max(10).optional(),
  asunto: z.string().trim().min(2).max(200).describe("Sin signos de admiración; en una respuesta, el asunto del hilo"),
  cuerpo: z.string().trim().min(2).max(8000).describe("Texto del correo, párrafos separados por una línea en blanco. Sin saludo de firma: la firma se agrega sola"),
  hilo: z.string().regex(/^[0-9a-f]{10,20}$/i).optional().describe("Id del hilo de Gmail si es una respuesta"),
  submarca: z.enum(["HOST", "LIVING"]).optional().describe("Solo Verse: HOST o LIVING según el tema; sin valor para el grupo"),
  pendiente: z.object({ empresa: z.enum(["verse", "cyc"]), numero: z.number().int() }).optional().describe("Fila de TRAZABILIDAD de la que sale el correo"),
  adjuntos: z
    .array(z.object({ id: z.string().regex(/^[\w-]{10,100}$/), nombre: z.string().trim().min(1).max(200) }))
    .max(5)
    .optional()
    .describe("Archivos de Drive a adjuntar, con el id y el nombre tal como los devolvió buscar_drive. Nunca inventes un id"),
});
export type DatosCorreo = z.infer<typeof ProponerCorreo> & { firma: string };

/** Nivel que la persona tiene sobre la cuenta, con el módulo Correo de su empresa. */
export function nivelEnCuenta(s: Sesion, cuenta: string): "sin" | "leer" | "redactar" | "enviar" {
  const c = cuentaPorId(cuenta);
  if (!c || !puede(s, c.empresa, `${c.empresa}-correo`, "ver")) return "sin";
  return nivelCorreo(s, c.empresa, c.id);
}

export const firmaDe = (s: Sesion) => s.nombreAirtable?.split(" ")[0] || "Felipe";

export const vistaPrevia = (d: Pick<DatosCorreo, "cuenta" | "cuerpo" | "firma" | "submarca">) => vistaPreviaCliente(d);

/** Valida que la persona pueda redactar desde la cuenta y, si responde, leer ese hilo. */
export function validarCorreo(s: Sesion, d: z.infer<typeof ProponerCorreo>): string | null {
  const nivel = nivelEnCuenta(s, d.cuenta);
  if (nivel === "sin" || nivel === "leer") {
    const propias = CUENTAS.filter((c) => ["redactar", "enviar"].includes(nivelEnCuenta(s, c.id))).map((c) => c.correo);
    return propias.length ? `Esta persona no redacta desde ${cuentaPorId(d.cuenta)!.correo}. Puede desde: ${propias.join(", ")}.` : "Esta persona no puede redactar correos.";
  }
  if (d.hilo && !cuentasLegibles(s).some((c) => c.id === d.cuenta)) return "Sin acceso al hilo en esa cuenta.";
  if (/!|¡/.test(d.asunto)) return "El asunto no lleva signos de admiración.";
  return null;
}
