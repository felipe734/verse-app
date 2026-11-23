import { CATALOGO } from "@/lib/airtable/mapeo";
import type { Columna, DefTabla } from "./tabla";

/**
 * Módulos de tabla de la entrega 5. Campos por nombre, revisados contra el esquema de Airtable
 * (2026-11-23). Lo sensible se marca: sin la casilla, ni se pide. Credenciales de plataformas
 * (RNT, FONTUR) y cuentas bancarias de propietarios y contratistas no se piden nunca.
 */

export function ids(base: string, tabla: string) {
  const sinTilde = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const f = CATALOGO.find((x) => sinTilde(x.base) === sinTilde(base) && x.tabla === tabla);
  if (!f) throw new Error(`${base} / ${tabla} no está en el catálogo`);
  return { idBase: f.idBase, idTabla: f.idTabla };
}

const t = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta });
const fecha = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, tipo: "fecha" });
const estado = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, tipo: "estado" });
const num = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, tipo: "numero" });
const plata = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, tipo: "dinero", sensible: "cifras" });
const tercero = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, sensible: "terceros" });
const codigo = (campo: string, etiqueta?: string): Columna => ({ campo, etiqueta, sensible: "codigos" });

/** Fórmula: la fecha cae entre hoy-desde y hoy+hasta (en días). */
const ventana = (campo: string, desde: number, hasta: number) => (hoy: string) =>
  `AND(IS_AFTER({${campo}}, DATEADD(DATETIME_PARSE('${hoy}'), ${-desde - 1}, 'days')), IS_BEFORE({${campo}}, DATEADD(DATETIME_PARSE('${hoy}'), ${hasta + 1}, 'days')))`;

export const TABLAS_EQUIPO: Record<string, DefTabla> = {
  operacion: {
    ...ids("6. OPERACION 360", "RESERVAS"),
    titulo: "Unidad",
    columnas: [t("Unidad"), t("Edificio"), t("Plataforma"), fecha("Ingreso"), fecha("Salida"), num("Noches"), plata("Total_H", "Total")],
    detalle: [t("ID Reserva", "Reserva"), t("Hora Ingreso"), t("NOVEDADES", "Novedades"), t("Comentario"), tercero("Nombre", "Huésped"), tercero("Celular H1", "Celular"), codigo("Código"), codigo("Red WIFI"), codigo("Pass WIFI")],
    formula: (hoy) => `AND(IS_AFTER({Salida}, DATEADD(DATETIME_PARSE('${hoy}'), -2, 'days')), IS_BEFORE({Ingreso}, DATEADD(DATETIME_PARSE('${hoy}'), 15, 'days')))`,
    orden: { campo: "Ingreso", desc: false },
    vacio: "No hay reservas de ayer a dos semanas",
  },
  limpiezas: {
    ...ids("6. OPERACION 360", "LIMPIEZA"),
    titulo: "Unidad",
    columnas: [t("Unidad"), fecha("Fecha"), t("Funcionario", "Funcionaria"), estado("Estado"), estado("Estado Pago", "Pago"), plata("Total")],
    formula: ventana("Fecha", 14, 7),
    orden: { campo: "Fecha", desc: true },
    vacio: "No hay limpiezas en estas tres semanas",
  },
  "unidades-host": {
    ...ids("5. INVENTARIO", "UNIDADES"),
    titulo: "Unidad",
    columnas: [t("Unidad"), t("Edificio"), t("Propietario"), estado("Estado"), t("Producto"), t("Tipo Servicio", "Servicio"), t("Canal")],
    detalle: [plata("Valor Limpieza"), plata("Precio Base"), plata("Precio Tope"), codigo("Metodo Ingreso", "Método de ingreso"), codigo("Codigo", "Código"), codigo("WIFI Red"), codigo("WIFI Contraseña")],
    orden: { campo: "Unidad", desc: false },
    max: 300,
  },
  liquidaciones: {
    ...ids("6. OPERACION 360", "F_CORTAS"),
    titulo: "Unidad",
    columnas: [t("Unidad"), fecha("Fecha"), t("Propietario"), t("Tipo Modelo", "Modelo"), estado("Estado"), plata("Factura_General", "Factura"), plata("Neto Propietario", "Neto propietario")],
    formula: ventana("Fecha", 95, 31),
    orden: { campo: "Fecha", desc: true },
    max: 300,
  },
  alistamiento: {
    ...ids("8. ALISTAMIENTO", "PROY_AMOB"),
    titulo: "Unidad",
    columnas: [t("Unidad"), t("Categoria", "Categoría"), t("Proveedor"), estado("Estado Pedido", "Pedido"), estado("Estado Pago", "Pago"), plata("Total"), plata("Pendiente")],
    max: 300,
  },
  "comercial-host": {
    ...ids("10. LEAD GEN", "LEADS"),
    titulo: "Nombre",
    columnas: [t("Nombre"), fecha("Fecha de Envio", "Llegó"), estado("Estado"), t("SDR"), t("Tipo_Propiedad", "Propiedad"), t("Ubicacion", "Ubicación"), t("Canal")],
    detalle: [tercero("WhatsApp"), tercero("Email", "Correo")],
    orden: { campo: "Fecha de Envio", desc: true },
    max: 150,
  },
  "unidades-living": {
    ...ids("7. LIVING", "UNIDADES"),
    titulo: "Unidad",
    columnas: [t("Unidad"), estado("Estado"), tercero("Nombre", "Arrendatario"), fecha("Fecha Salida", "Salida"), num("Días Restantes", "Días"), plata("Total")],
    detalle: [plata("Canon"), plata("Admin"), plata("Servicios"), tercero("Celular"), tercero("Correo")],
    orden: { campo: "Unidad", desc: false },
    max: 300,
  },
  contratos: {
    ...ids("7. LIVING", "CONTRATO"),
    titulo: "Unidad",
    columnas: [t("Unidad"), t("Edificio"), tercero("Nombre", "Arrendatario"), estado("Estado"), fecha("Fecha_Inicio", "Inicio"), fecha("Fecha_Finalización", "Fin"), plata("Canon_Servicios", "Canon y servicios")],
    detalle: [t("Contrato_ID", "Contrato"), tercero("Celular"), tercero("Correo")],
    orden: { campo: "Fecha_Inicio", desc: true },
    max: 200,
  },
  cobros: {
    ...ids("7. LIVING", "INGRESOS"),
    titulo: "Unidad",
    columnas: [t("Unidad"), fecha("Fecha"), t("Edificio"), tercero("Arrendatario"), estado("Estado"), plata("Canon"), plata("Total")],
    formula: ventana("Fecha", 62, 31),
    orden: { campo: "Fecha", desc: true },
    max: 300,
  },
  "comercial-living": {
    ...ids("7. LIVING", "WEB LEADS"),
    titulo: "Nombre",
    columnas: [t("Nombre"), fecha("Fecha"), t("Tipo"), t("Producto"), t("Unidad"), t("Zona"), t("Presupuesto")],
    detalle: [tercero("WhatsApp"), tercero("Correo")],
    orden: { campo: "Fecha", desc: true },
    max: 150,
  },
  equipo: {
    ...ids("6. OPERACION 360", "CONTROL HORAS"),
    titulo: "Funcionaria",
    columnas: [t("Funcionaria"), fecha("Ingreso"), fecha("Salida"), num("Horas"), t("Semana"), t("Validado")],
    formula: ventana("Ingreso", 14, 1),
    orden: { campo: "Ingreso", desc: true },
    max: 300,
    vacio: "No hay turnos registrados en dos semanas",
  },
  actas: {
    ...ids("11. ACTAS OBRA", "ACTAS"),
    titulo: "Acta",
    columnas: [t("Acta"), fecha("Fecha"), t("Contratista"), t("Fase"), estado("Estado"), plata("Total Corte", "Total corte"), plata("A pagar")],
    orden: { campo: "Fecha", desc: true },
    max: 200,
  },
  "pagos-obra": {
    ...ids("12. EDIFICIO 54-47", "CONTABILIDAD"),
    titulo: "Concepto",
    columnas: [t("Concepto"), fecha("Fecha Pago", "Fecha de pago"), t("Contratista"), t("Fuente"), estado("Estado"), plata("Monto")],
    formula: ventana("Fecha Pago", 62, 31),
    orden: { campo: "Fecha Pago", desc: true },
    max: 300,
  },
  contratistas: {
    ...ids("11. ACTAS OBRA", "CONTRATISTAS"),
    titulo: "Contratista",
    columnas: [t("Contratista"), t("Razón social"), t("Contrato N.º", "Contrato"), tercero("NIT"), plata("Valor contrato"), plata("Base retención")],
    orden: { campo: "Contratista", desc: false },
  },
  calidad: {
    ...ids("12. EDIFICIO 54-47", "PRUEBAS CONCRETO"),
    titulo: "Concepto",
    columnas: [t("Concepto"), fecha("Fecha Toma", "Toma"), t("Proveedor"), num("Cilindros"), fecha("Dia de Ensayo", "Ensayo"), num("Dias Prueba", "Días"), t("Aprobado JML", "Aprobado")],
    orden: { campo: "Fecha Toma", desc: true },
  },
};
