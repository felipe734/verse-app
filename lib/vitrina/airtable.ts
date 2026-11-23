import type { ClienteAirtable, RegistroAirtable } from "@/lib/airtable/cliente";

/** Airtable de solo lectura para la vitrina: filas inventadas con los campos pedidos. */
export function airtableVitrina(): ClienteAirtable {
  const valor = (campo: string, i: number): string => {
    const c = campo.toLowerCase();
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
    async consultar(_b: string, _t: string, o: { campos: string[] }) {
      return Array.from({ length: 8 }, (_, i): RegistroAirtable => ({
        id: `recVITRINATAB${String(i).padStart(4, "0")}`,
        createdTime: "2026-11-01T00:00:00.000Z",
        fields: Object.fromEntries(o.campos.map((c: string) => [c, valor(c, i)])),
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
