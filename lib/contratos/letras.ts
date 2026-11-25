/**
 * Números y fechas en español para los contratos: "$2.500.000", "dos millones quinientos mil",
 * "27 de noviembre de 2026". Mismas reglas que verse-legal (num2words con "un millón").
 */

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function hastaMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes = [CENTENAS[c]!];
  if (r < 30) partes.push(UNIDADES[r]!);
  else partes.push(DECENAS[Math.floor(r / 10)]! + (r % 10 ? ` y ${UNIDADES[r % 10]}` : ""));
  return partes.filter(Boolean).join(" ");
}

/** "uno" se apocopa delante de mil y millones: "veintiún mil", "un millón". */
const apocope = (t: string) => t.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");

export function enLetras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e12) throw new Error(`Número fuera de rango: ${n}`);
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${apocope(enLetras(millones))} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${apocope(hastaMil(miles))} mil`);
  if (resto) partes.push(hastaMil(resto));
  return partes.join(" ");
}

const conPuntos = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** "$2.500.000" */
export const pesos = (n: number): string => `$${conPuntos(n)}`;

/** "1.020.832.461" para documentos numéricos; otros se dejan tal cual. */
export const documento = (d: string): string => (/^\d+$/.test(d.trim()) ? conPuntos(Number(d.trim())) : d.trim());

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "2026-11-27" → "27 de noviembre de 2026" */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) throw new Error(`Fecha inválida: ${iso}`);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** Suma meses y conserva el día (31 de enero + 1 mes = 28 o 29 de febrero), como en CONTRATO. */
export function sumarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const total = m - 1 + meses;
  const anio = a + Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}
