import type { ClienteAirtable, RegistroAirtable } from "@/lib/airtable/cliente";

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
  return null;
}

/** Airtable de solo lectura para la vitrina: filas inventadas con los campos pedidos. */
export function airtableVitrina(): ClienteAirtable {
  const DINERO = new Set(["TOTAL INGRESOS", "CONTRIBUCIÓN TOTAL", "OVERHEAD COSTO", "MARGEN NETO", "Débito", "Crédito", "Egreso"]);
  const valor = (campo: string, i: number): string => {
    const c = campo.toLowerCase();
    if (DINERO.has(campo)) return `$${(campo === "MARGEN NETO" ? 4_200_000 - i * 310_000 : 38_000_000 - i * 1_250_000).toLocaleString("es-CO")}`;
    if (/fecha|ingreso|salida|inicio|fin|día|dia|corte/.test(c)) return `${(i % 27) + 1}/11/2026`;
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
    esquema: no,
    todos: no,
    porIds: no,
    obtener: no,
    actualizar: no,
    crear: no,
    crearTabla: no,
    crearVarios: no,
    crearWebhook: no,
    renovarWebhook: no,
    payloads: no,
  } as unknown as ClienteAirtable;
}
