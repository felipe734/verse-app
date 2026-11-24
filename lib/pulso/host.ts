import type { ClienteAirtable, RegistroAirtable } from "@/lib/airtable/cliente";
import type { EmpresaBase } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { rutaModulo } from "@/lib/alertas/operacion";
import { ids } from "@/lib/modulos/tablas-equipo";
import { leerFecha } from "@/lib/vistas/fechas";
import { sumarDias } from "@/lib/vistas/periodo";

/**
 * Pulso de Verse Host: cómo está la operación hoy y mañana, en una mirada.
 * Ocupación, entradas, salidas y aseos. Solo lee (Airtable con la caché de 60 s) y no trae
 * montos. Aparece para quien ve Operación; los aseos, para quien ve Limpiezas.
 */
export interface Movimiento {
  unidad: string;
  hora: string;
}

export interface DiaPulso {
  fecha: string;
  entradas: Movimiento[];
  salidas: Movimiento[];
  /** null si la persona no ve Limpiezas. */
  aseos: { total: number; terminados: number; sinFuncionaria: string[] } | null;
}

export interface PulsoHost {
  ocupadas: number;
  /** Unidades activas de alquiler (Estado Actual y Producto Operación 360 o Digital). null si no se pudo leer. */
  activas: number | null;
  hoy: DiaPulso;
  manana: DiaPulso;
  enlaces: { operacion: string; limpiezas: string | null };
}

const texto = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v));
const dia = (campo: string) => `VALUE(DATETIME_FORMAT(SET_TIMEZONE({${campo}}, 'America/Bogota'), 'YYYYMMDD'))`;
const num = (t: string) => t.replaceAll("-", "");
/** "2:00 p. m." → minutos, para ordenar; sin hora va al final. */
const minutos = (h: string) => {
  const m = h.match(/^(\d{1,2}):(\d{2}) ([ap])/);
  if (!m) return 24 * 60;
  return ((Number(m[1]) % 12) + (m[3] === "p" ? 12 : 0)) * 60 + Number(m[2]);
};
const porHora = (a: Movimiento, b: Movimiento) => minutos(a.hora) - minutos(b.hora) || a.unidad.localeCompare(b.unidad);

/** Cálculo puro: filas de RESERVAS y LIMPIEZA → pulso de hoy y mañana. */
export function calcularPulso(reservas: RegistroAirtable[], limpiezas: RegistroAirtable[] | null, activas: number | null, hoy: string, enlaces: PulsoHost["enlaces"]): PulsoHost {
  const manana = sumarDias(hoy, 1);
  const rs = reservas
    .map((r) => ({
      unidad: texto(r.fields["Unidad"]),
      ingreso: leerFecha(texto(r.fields["Ingreso"]))?.fecha,
      salida: leerFecha(texto(r.fields["Salida"]))?.fecha,
      hora: leerFecha(`2000-01-01 ${texto(r.fields["Hora Ingreso"])}`)?.hora ?? "",
    }))
    .filter((r): r is typeof r & { ingreso: string; salida: string } => Boolean(r.unidad && r.ingreso && r.salida));
  const ls = (limpiezas ?? []).map((l) => {
    const f = leerFecha(texto(l.fields["Fecha"]));
    return { unidad: texto(l.fields["Unidad"]), fecha: f?.fecha, hora: f?.hora ?? "", funcionaria: texto(l.fields["Funcionario"]), estado: texto(l.fields["Estado"]) };
  });

  const diaDe = (fecha: string): DiaPulso => {
    const delDia = ls.filter((l) => l.fecha === fecha);
    return {
      fecha,
      entradas: rs.filter((r) => r.ingreso === fecha).map((r) => ({ unidad: r.unidad, hora: r.hora })).sort(porHora),
      salidas: rs.filter((r) => r.salida === fecha).map((r) => ({ unidad: r.unidad, hora: "" })).sort(porHora),
      aseos: limpiezas
        ? {
            total: delDia.length,
            terminados: delDia.filter((l) => l.estado === "Terminado").length,
            sinFuncionaria: delDia.filter((l) => !l.funcionaria).map((l) => l.unidad || "Unidad"),
          }
        : null,
    };
  };

  // Ocupada hoy: la noche de hoy está dentro de la reserva (ingreso ≤ hoy < salida).
  const ocupadas = new Set(rs.filter((r) => r.ingreso <= hoy && hoy < r.salida).map((r) => r.unidad)).size;
  return { ocupadas, activas, hoy: diaDe(hoy), manana: diaDe(manana), enlaces };
}

/** Lee lo necesario y arma el pulso, o null si la persona no ve Operación de Verse. */
export async function pulsoHost(c: { airtable: ClienteAirtable; s: Sesion; estructura: EmpresaBase[]; hoy: string }): Promise<PulsoHost | null> {
  const operacion = rutaModulo(c.s, c.estructura, "verse", "operacion");
  if (!operacion) return null;
  const limpiezas = rutaModulo(c.s, c.estructura, "verse", "limpiezas");
  const R = ids("6. OPERACION 360", "RESERVAS");
  const L = ids("6. OPERACION 360", "LIMPIEZA");
  const U = ids("6. OPERACION 360", "UNIDADES");
  const desde = num(c.hoy);
  const hasta = num(sumarDias(c.hoy, 1));
  const [reservas, aseos, unidades] = await Promise.all([
    c.airtable.consultar(R.idBase, R.idTabla, {
      campos: ["Unidad", "Ingreso", "Salida", "Hora Ingreso"],
      formula: `AND({Ingreso}, {Salida}, ${dia("Ingreso")} <= ${hasta}, ${dia("Salida")} >= ${desde})`,
      max: 300,
    }),
    limpiezas
      ? c.airtable.consultar(L.idBase, L.idTabla, {
          campos: ["Unidad", "Fecha", "Funcionario", "Estado"],
          formula: `AND({Fecha}, ${dia("Fecha")} >= ${desde}, ${dia("Fecha")} <= ${hasta})`,
          max: 200,
        })
      : Promise.resolve(null),
    c.airtable
      .consultar(U.idBase, U.idTabla, {
        campos: ["Unidad"],
        formula: `AND({Estado} = 'Actual', OR({Producto} = 'Operación 360', {Producto} = 'Digital'))`,
        max: 300,
      })
      .then((f) => f.length)
      .catch((e) => {
        console.error("[pulso] unidades", e instanceof Error ? e.message : e);
        return null;
      }),
  ]);
  return calcularPulso(reservas, aseos, unidades || null, c.hoy, { operacion, limpiezas });
}
