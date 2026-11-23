/**
 * "Lo mío": cada módulo que tiene un campo de persona (Funcionaria, SDR, Persona) puede
 * mostrar solo lo de quien entra. La persona se reconoce por su Nombre en Airtable, sin
 * tildes ni mayúsculas y por su primer nombre: en Airtable el mismo nombre aparece escrito de
 * varias formas ("Edy", "Edy Borre", "Edy Borrre").
 */
const normal = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function esMio(valor: string | undefined, nombre: string | null | undefined): boolean {
  if (!valor || !nombre) return false;
  const v = normal(valor);
  const n = normal(nombre);
  if (!n) return false;
  if (v === n) return true;
  const primero = n.split(/\s+/)[0]!;
  // Por palabra: "Edy" coincide con "Edy Borrre", pero "Ana" no con "Anabel".
  return v.split(/[\s,]+/).includes(primero);
}
