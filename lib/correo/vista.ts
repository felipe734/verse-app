import { cuentaPorId } from "./cuentas";
import { htmlCorreo } from "./marca";

/** Vista previa con la marca de la cuenta que envía. Pura: sirve en el servidor y en la tarjeta. */
export function vistaPreviaCliente(d: { cuenta: string; cuerpo: string; firma: string; submarca?: string }): string {
  const c = cuentaPorId(d.cuenta);
  if (!c) return "";
  return htmlCorreo({
    empresa: c.empresa,
    submarca: d.submarca,
    cuerpo: d.cuerpo,
    firma: d.firma,
    pie: `${c.empresa === "cyc" ? "C&C GROUP SAS" : "VERSE GROUP SAS"} · ${c.correo}`,
  });
}
