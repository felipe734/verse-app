import { z } from "zod";
import type { ClienteAirtable } from "@/lib/airtable/cliente";
import { CATALOGO } from "@/lib/airtable/mapeo";
import { puede, sensibles, type Sesion } from "@/lib/acceso/permisos";

/**
 * Herramientas que leen Airtable en el momento (solo lectura), para tablas que la app no copia:
 * reservas de 6. OPERACION 360 y el cierre mensual en AGREGADO de 2. FACTURACION.
 * Los campos se piden por nombre y solo los que la persona puede ver: montos, datos del
 * huésped y códigos se quedan en Airtable si su casilla no los abre.
 */

function tabla(base: string, nombre: string) {
  const f = CATALOGO.find((x) => x.base === base && x.tabla === nombre);
  if (!f) throw new Error(`${base} / ${nombre} no está en el catálogo`);
  return { idBase: f.idBase, idTabla: f.idTabla };
}

const limpio = (s: string) => s.replace(/["'\\{}]/g, "").slice(0, 40);

export const BuscarReservas = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD; por defecto hoy"),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD; por defecto 7 días después"),
  unidad: z.string().max(40).optional().describe("Parte del nombre de la unidad o del edificio"),
});

const CAMPOS_RESERVA = ["ID Reserva", "Unidad", "Edificio", "Plataforma", "Ingreso", "Salida", "Noches", "Hora Ingreso", "Requiere Limpieza", "NOVEDADES", "Comentario"];
const CAMPOS_HUESPED = ["Nombre", "Celular H1"];
const CAMPOS_DINERO = ["Alojamiento", "Aseo", "TOT"];
const CAMPOS_CODIGOS = ["Código", "Red WIFI", "Pass WIFI"];

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function buscarReservas(airtable: ClienteAirtable, s: Sesion, entrada: z.infer<typeof BuscarReservas>, hoy: string) {
  if (!puede(s, "verse", "host-operacion", "ver")) return { error: "Sin acceso a la operación de Verse Host." };
  const sens = sensibles(s, "verse", "verse-host");
  const desde = entrada.desde ?? hoy;
  const hasta = entrada.hasta ?? sumarDias(desde, 7);
  if (hasta < desde) return { error: "La fecha final es anterior a la inicial." };
  const campos = [
    ...CAMPOS_RESERVA,
    ...(sens.terceros ? CAMPOS_HUESPED : []),
    ...(sens.cifras ? CAMPOS_DINERO : []),
    // "Solo en su turno" no aplica al asistente: los códigos solo salen con "Siempre".
    ...(sens.codigos === "siempre" ? CAMPOS_CODIGOS : []),
  ];
  const condiciones = [
    `IS_BEFORE({Ingreso}, DATEADD(DATETIME_PARSE('${desde}'), ${Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1}, 'days'))`,
    `IS_AFTER({Salida}, DATEADD(DATETIME_PARSE('${desde}'), -1, 'days'))`,
  ];
  if (entrada.unidad) {
    const u = limpio(entrada.unidad).toLowerCase();
    condiciones.push(`OR(FIND('${u}', LOWER(ARRAYJOIN({Unidad}))), FIND('${u}', LOWER(ARRAYJOIN({Edificio}))))`);
  }
  const { idBase, idTabla } = tabla("6. OPERACION 360", "RESERVAS");
  const filas = await airtable.consultar(idBase, idTabla, { formula: `AND(${condiciones.join(", ")})`, campos, max: 60 });
  return {
    desde,
    hasta,
    total: filas.length,
    reservas: filas.map((f) => f.fields),
    ocultos: [!sens.terceros && "datos del huésped", !sens.cifras && "montos", sens.codigos !== "siempre" && "códigos y wifi"].filter(Boolean),
  };
}

export const VerCierre = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).describe("Mes AAAA-MM") });

/** AGREGADO trae una fila por mes con Fecha D/M/AAAA (formato de la tabla). */
function mesDeFecha(fecha: unknown): string | null {
  if (typeof fecha !== "string") return null;
  const m = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}`;
  const iso = fecha.match(/^(\d{4})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}` : null;
}

function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

export async function verCierre(airtable: ClienteAirtable, s: Sesion, entrada: z.infer<typeof VerCierre>) {
  if (!puede(s, "verse", "verse-finanzas", "ver")) return { error: "Sin acceso a Finanzas de Verse." };
  if (!sensibles(s, "verse", "verse-general").cifras) return { error: "Sin acceso a cifras de dinero." };
  const { idBase, idTabla } = tabla("2. FACTURACION", "AGREGADO");
  // Pocas filas (una por mes): se leen todas y se elige el mes aquí, sin depender de nombres en fórmulas.
  const filas = await airtable.consultar(idBase, idTabla, { campos: [], max: 100 });
  const porMes = new Map(filas.map((f) => [mesDeFecha(f.fields["Fecha"]), f.fields]));
  const actual = porMes.get(entrada.mes);
  const anterior = porMes.get(mesAnterior(entrada.mes));
  if (!actual) return { error: `AGREGADO no tiene ${entrada.mes}. Se llena en el Cierre B (día 5 del mes siguiente).`, meses_disponibles: [...porMes.keys()].filter(Boolean).sort().slice(-6) };
  return { mes: entrada.mes, cierre: actual, mes_anterior: anterior ?? null };
}
