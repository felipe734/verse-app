import type { ClienteAirtable, RegistroAirtable } from "@/lib/airtable/cliente";
import { ESCRITURA, TABLAS } from "@/lib/airtable/mapeo";

type Mapeada = { idBase: string; campos: Record<string, { id: string; nombre: string; tipo: string }> };
const MAPEADAS = [...Object.values(TABLAS), ...Object.values(ESCRITURA ?? {})] as unknown as Mapeada[];
const OPCIONES = ["Pendiente", "En curso", "Hecho"];

/** Para editar en la vitrina: los campos mapeados de la base con valores de ejemplo. */
function filaVitrina(idBase: string, id: string): RegistroAirtable {
  const fields: Record<string, unknown> = {};
  for (const t of MAPEADAS.filter((x) => x.idBase === idBase))
    for (const c of Object.values(t.campos)) fields[c.id] = c.tipo === "singleSelect" ? OPCIONES[0] : c.tipo === "checkbox" ? false : c.tipo.endsWith("Text") ? `${c.nombre} de prueba` : null;
  return reg(id, fields);
}

function esquemaVitrina(idBase: string) {
  const campos = MAPEADAS.filter((x) => x.idBase === idBase).flatMap((t) => Object.values(t.campos));
  return [{ id: "tblVITRINA000000", name: "VITRINA", fields: campos.map((c) => ({ id: c.id, name: c.nombre, type: c.tipo, ...(c.tipo === "singleSelect" ? { options: { choices: OPCIONES.map((name) => ({ name })) } } : {}) })) }];
}

const reg = (id: string, fields: Record<string, unknown>): RegistroAirtable => ({ id, createdTime: "2026-11-01T00:00:00.000Z", fields });

/** Ruta de aseo de la vitrina: dos funcionarias inventadas, tres limpiezas hoy y ningún turno abierto. */
function rutaVitrina(o: { campos: string[]; formula?: string }): RegistroAirtable[] | null {
  if (o.campos.includes("Nombre en LIMPIEZA"))
    return [
      reg("recVITRINAFUN0001", { Nombre: "Edy Prueba", Activa: "checked", Correo: "edy@vitrina.test", "Nombre en LIMPIEZA": "Edy Prueba", "Nombre en SERVICIOS": "Edy Prueba", "Nombre en CONTROL HORAS": "Edy" }),
      reg("recVITRINAFUN0002", { Nombre: "Sara Prueba", Activa: "checked", Correo: "", "Nombre en LIMPIEZA": "Sara Prueba", "Nombre en SERVICIOS": "", "Nombre en CONTROL HORAS": "" }),
    ];
  if (o.formula?.includes("ARRAYJOIN({Funcionaria enlace})") && o.campos.includes("Comentario")) {
    const hoy = new Date(Date.now() - 5 * 3_600_000);
    const d = `${hoy.getUTCDate()}/${hoy.getUTCMonth() + 1}/${hoy.getUTCFullYear()}`;
    return [
      reg("recVITRINALIM0001", { Unidad: "Torre Norte 603", Fecha: `${d} 8:30am`, Estado: "Terminado", Comentario: "Salida huésped de prueba" }),
      reg("recVITRINALIM0002", { Unidad: "Parque 1104", Fecha: `${d} 11:00am`, Estado: "Programado", Comentario: "Alistamiento ingreso" }),
      reg("recVITRINALIM0003", { Unidad: "Balcony 302", Fecha: `${d} 2:00pm`, Estado: "Programado", Comentario: "Salida huésped de prueba" }),
    ];
  }
  if (o.formula?.includes("ARRAYJOIN({Funcionaria enlace})")) return [];
  // Pulso de Host: reservas alrededor de hoy.
  if (o.campos.includes("Hora Ingreso") && o.campos.length === 4) {
    const d = (n: number) => {
      const x = new Date(Date.now() - 5 * 3_600_000 + n * 86_400_000);
      return `${x.getUTCDate()}/${x.getUTCMonth() + 1}/${x.getUTCFullYear()}`;
    };
    return [
      reg("recVITRINARES0001", { Unidad: "Torre Norte 603", Ingreso: d(-2), Salida: d(0), "Hora Ingreso": "" }),
      reg("recVITRINARES0002", { Unidad: "Balcony 302", Ingreso: d(0), Salida: d(3), "Hora Ingreso": "3:00 PM" }),
      reg("recVITRINARES0003", { Unidad: "Parque 1104", Ingreso: d(-1), Salida: d(1), "Hora Ingreso": "" }),
      reg("recVITRINARES0004", { Unidad: "Torre Norte 805", Ingreso: d(1), Salida: d(4), "Hora Ingreso": "1:00 PM" }),
    ];
  }
  if (o.formula?.includes("{Tipo Servicio}")) return Array.from({ length: 12 }, (_, i) => reg(`recVITRINAUNI${String(i).padStart(4, "0")}`, { Unidad: `Unidad ${i + 1}` }));
  return null;
}

/** Airtable de solo lectura para la vitrina: filas inventadas con los campos pedidos. */
export function airtableVitrina(): ClienteAirtable {
  const DINERO = new Set(["TOTAL INGRESOS", "CONTRIBUCIÓN TOTAL", "OVERHEAD COSTO", "MARGEN NETO", "Débito", "Crédito", "Egreso"]);
  const valor = (campo: string, i: number): string => {
    const c = campo.toLowerCase();
    if (DINERO.has(campo)) return `$${(campo === "MARGEN NETO" ? 4_200_000 - i * 310_000 : 38_000_000 - i * 1_250_000).toLocaleString("es-CO")}`;
    if (/finaliz/.test(c)) return `${(i % 24) + 1}/${(i % 3) + 1}/2027`;
    if (c === "salida") return `${Math.min(28, (i % 24) + 1 + 2 + (i % 4))}/11/2026`;
    if (c === "fecha") return `${(i % 7) + 23 > 30 ? (i % 7) - 7 + 23 : (i % 7) + 23}/11/2026 ${["8:30am", "11:00am", "2:00pm"][i % 3]}`;
    if (/fecha|ingreso|salida|inicio|fin|día|dia|corte/.test(c)) return `${(i % 24) + 1}/11/2026`;
    if (/valor|total|monto|canon|pago|tot|aseo|alojamiento|precio|saldo|costo/.test(c)) return `$${(450000 + i * 37500).toLocaleString("es-CO")}`;
    if (/estado/.test(c)) return ["Activo", "Pendiente", "Hecho"][i % 3]!;
    if (/unidad|apto|apartamento/.test(c)) return ["Torre Norte 603", "Torre Norte 805", "Balcony 302", "Parque 1104"][i % 4]!;
    if (/edificio|conjunto/.test(c)) return ["Torre Norte", "Balcony", "Parque"][i % 3]!;
    if (/celular|tel|correo|email|documento|cédula|cedula|cuenta/.test(c)) return "dato protegido de prueba";
    if (/nombre|contratista|propietario|arrendatario|funcionaria|responsable|cliente|lead/.test(c)) return ["Persona Prueba", "Empresa Ejemplo SAS", "Cliente Demo"][i % 3]!;
    if (/noches|cantidad|horas|número|numero|#/.test(c)) return String((i % 6) + 1);
    return `${campo} ${i + 1}`;
  };
  const no = () => {
    throw new Error("La vitrina es de solo lectura");
  };
  return {
    async consultar(_b: string, _t: string, o: { campos: string[]; formula?: string }) {
      const especial = rutaVitrina(o);
      if (especial) return especial;
      return Array.from({ length: 8 }, (_, i): RegistroAirtable => ({
        id: `recVITRINATAB${String(i).padStart(4, "0")}`,
        createdTime: "2026-11-01T00:00:00.000Z",
        // El cierre (AGREGADO) trae un mes por fila.
        fields: Object.fromEntries(o.campos.map((c: string) => [c, c === "Fecha" && o.campos.includes("MARGEN NETO") ? `1/${10 - i}/2026` : valor(c, i)])),
      }));
    },
    esquema: async (idBase: string) => esquemaVitrina(idBase) as never,
    todos: no,
    porIds: no,
    obtener: async (idBase: string, _t: string, id: string) => filaVitrina(idBase, id),
    actualizar: no,
    crear: no,
    crearTabla: no,
    crearVarios: no,
    crearWebhook: no,
    renovarWebhook: no,
    payloads: no,
  } as unknown as ClienteAirtable;
}
