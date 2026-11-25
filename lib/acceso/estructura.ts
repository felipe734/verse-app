/**
 * Estructura de arranque de la app (doc del plan, "Empresas, verticales y módulos").
 * Se siembra en Postgres una sola vez; después se edita desde Ajustes.
 */

export interface ModuloBase {
  id: string;
  nombre: string;
  descripcion: string;
  /** Tipo de pantalla en el registro de módulos (lib/modulos/registro.ts). */
  tipo?: string;
}

export interface VerticalBase {
  id: string;
  nombre: string;
  modulos: ModuloBase[];
}

export interface EmpresaBase {
  id: string;
  nombre: string;
  verticales: VerticalBase[];
  /** Cuentas de correo de la empresa (os-correo). */
  cuentas: { id: string; nombre: string }[];
  /** Color de acento (hex) y logo: lo único que cambia por empresa. */
  acento?: string;
  logo?: string | null;
}

export const ESTRUCTURA: EmpresaBase[] = [
  {
    id: "verse",
    nombre: "Verse Group",
    acento: "#2453d6",
    cuentas: [
      { id: "verse-felipe", nombre: "felipe@" },
      { id: "verse-contabilidad", nombre: "contabilidad@" },
      { id: "verse-contacto", nombre: "contacto@" },
    ],
    verticales: [
      {
        id: "verse-general",
        nombre: "General",
        modulos: [
          { id: "verse-hoy", nombre: "Hoy", descripcion: "Pendientes y corridas por urgencia y persona", tipo: "hoy" },
          { id: "verse-aprobar", nombre: "Para aprobar", descripcion: 'Filas "Aprobar:" con el cambio propuesto', tipo: "aprobar" },
          { id: "verse-correo", nombre: "Correo", descripcion: "Bandeja ruteada y borradores con IA", tipo: "correo" },
          { id: "verse-finanzas", nombre: "Finanzas", descripcion: "Cierre contra la meta, margen, cruces, extractos, overhead y caja menor", tipo: "finanzas" },
          { id: "verse-equipo", nombre: "Equipo", descripcion: "Horas, objetivos, nómina y permisos", tipo: "equipo" },
          { id: "verse-sistema", nombre: "Sistema", descripcion: "Corridas, salud de datos, recurrentes y respaldos", tipo: "sistema" },
        ],
      },
      {
        id: "verse-host",
        nombre: "Host",
        modulos: [
          { id: "host-operacion", nombre: "Operación", descripcion: "Reservas del día y la semana, huéspedes, adicionales", tipo: "operacion" },
          { id: "host-limpiezas", nombre: "Limpiezas", descripcion: "Programación semanal y servicios hechos", tipo: "limpiezas" },
          { id: "host-ruta", nombre: "Ruta de aseo", descripcion: "Ruta del día, turno y reporte de cada funcionaria", tipo: "ruta" },
          { id: "host-unidades", nombre: "Unidades Host", descripcion: "Ficha de unidad, edificio, propietario e inventario", tipo: "unidades-host" },
          { id: "host-liquidaciones", nombre: "Liquidaciones", descripcion: "Liquidaciones del mes, pólizas, servicios públicos y pago a propietarios", tipo: "liquidaciones" },
          { id: "host-alistamiento", nombre: "Alistamiento", descripcion: "Amoblamiento, lencería, setup y proveedores", tipo: "alistamiento" },
          { id: "host-comercial", nombre: "Comercial Host", descripcion: "Leads de propietarios, conjuntos y contenido", tipo: "comercial-host" },
          { id: "host-tickets", nombre: "Tickets", descripcion: "Novedades de las unidades: daños, faltantes, implementos y mantenimiento", tipo: "tickets" },
        ],
      },
      {
        id: "verse-living",
        nombre: "Living",
        modulos: [
          { id: "living-unidades", nombre: "Unidades Living", descripcion: "Unidades de Living y Balcony con su estado", tipo: "unidades-living" },
          { id: "living-contratos", nombre: "Generación de contratos", descripcion: "Contratos por elaborar, firmar y firmados", tipo: "contratos" },
          { id: "living-cobros", nombre: "Cobros", descripcion: "Cánones del mes, facturas CYC y fianzas", tipo: "cobros" },
          { id: "living-balcony", nombre: "Balcony PH", descripcion: "Administración, residentes, banco y balances de la PH", tipo: "balcony" },
          { id: "living-comercial", nombre: "Comercial Living", descripcion: "Leads de la web", tipo: "comercial-living" },
        ],
      },
    ],
  },
  {
    id: "cyc",
    nombre: "C&C Group",
    acento: "#0f766e",
    cuentas: [
      { id: "cyc-comercial", nombre: "comercial@" },
      { id: "cyc-contabilidad", nombre: "contabilidad@" },
    ],
    verticales: [
      {
        id: "cyc-general",
        nombre: "General",
        modulos: [
          { id: "cyc-hoy", nombre: "Hoy", descripcion: "Pendientes y corridas de C&C", tipo: "hoy" },
          { id: "cyc-aprobar", nombre: "Para aprobar", descripcion: 'Filas "Aprobar:" de C&C con el cambio propuesto', tipo: "aprobar" },
          { id: "cyc-correo", nombre: "Correo", descripcion: "Bandeja ruteada y borradores con IA", tipo: "correo" },
          { id: "cyc-finanzas", nombre: "Finanzas C&C", descripcion: "Extractos, bancos, caja y referencias bancarias", tipo: "finanzas-cyc" },
          { id: "cyc-sistema", nombre: "Sistema", descripcion: "Corridas de C&C OS", tipo: "sistema" },
        ],
      },
      {
        id: "cyc-obra",
        nombre: "Obra 54-47",
        modulos: [
          { id: "obra-actas", nombre: "Actas", descripcion: "Cortes, ítems y liquidación por contratista", tipo: "actas" },
          { id: "obra-pagos", nombre: "Pagos de obra", descripcion: "Pagos marcados HOY y sus soportes", tipo: "pagos-obra" },
          { id: "obra-contratistas", nombre: "Contratistas", descripcion: "Datos, contratos y anticipos", tipo: "contratistas" },
          { id: "obra-calidad", nombre: "Calidad", descripcion: "Pruebas de concreto", tipo: "calidad" },
          { id: "obra-diseno", nombre: "Diseño y compras", descripcion: "Especificaciones, fachada, importación y medidas", tipo: "diseno" },
        ],
      },
    ],
  },
];

export const modulosDe = (empresa: EmpresaBase, vertical?: string) =>
  empresa.verticales.filter((v) => !vertical || v.id === vertical).flatMap((v) => v.modulos.map((m) => m.id));

export function empresaBase(id: string): EmpresaBase {
  const e = ESTRUCTURA.find((x) => x.id === id);
  if (!e) throw new Error(`Empresa desconocida: ${id}`);
  return e;
}
