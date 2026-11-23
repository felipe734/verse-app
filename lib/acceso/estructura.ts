/**
 * Estructura de arranque de la app (doc del plan, "Empresas, verticales y módulos").
 * Se siembra en Postgres una sola vez; después se edita desde Ajustes.
 */

export interface ModuloBase {
  id: string;
  nombre: string;
  descripcion: string;
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
}

export const ESTRUCTURA: EmpresaBase[] = [
  {
    id: "verse",
    nombre: "Verse Group",
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
          { id: "verse-hoy", nombre: "Hoy", descripcion: "Pendientes y corridas por urgencia y persona" },
          { id: "verse-aprobar", nombre: "Para aprobar", descripcion: 'Filas "Aprobar:" con el cambio propuesto' },
          { id: "verse-correo", nombre: "Correo", descripcion: "Bandeja ruteada y borradores con IA" },
          { id: "verse-finanzas", nombre: "Finanzas", descripcion: "Cierre contra la meta, margen, cruces, extractos, overhead y caja menor" },
          { id: "verse-equipo", nombre: "Equipo", descripcion: "Horas, objetivos, nómina y permisos" },
          { id: "verse-sistema", nombre: "Sistema", descripcion: "Corridas, salud de datos, recurrentes y respaldos" },
        ],
      },
      {
        id: "verse-host",
        nombre: "Host",
        modulos: [
          { id: "host-operacion", nombre: "Operación", descripcion: "Reservas del día y la semana, huéspedes, adicionales" },
          { id: "host-limpiezas", nombre: "Limpiezas", descripcion: "Programación semanal y servicios hechos" },
          { id: "host-ruta", nombre: "Ruta de aseo", descripcion: "Ruta del día, turno y reporte de cada funcionaria" },
          { id: "host-unidades", nombre: "Unidades Host", descripcion: "Ficha de unidad, edificio, propietario e inventario" },
          { id: "host-liquidaciones", nombre: "Liquidaciones", descripcion: "Liquidaciones del mes, pólizas, servicios públicos y pago a propietarios" },
          { id: "host-alistamiento", nombre: "Alistamiento", descripcion: "Amoblamiento, lencería, setup y proveedores" },
          { id: "host-comercial", nombre: "Comercial Host", descripcion: "Leads de propietarios, conjuntos y contenido" },
        ],
      },
      {
        id: "verse-living",
        nombre: "Living",
        modulos: [
          { id: "living-unidades", nombre: "Unidades Living", descripcion: "Unidades de Living y Balcony con su estado" },
          { id: "living-contratos", nombre: "Contratos", descripcion: "Contratos vigentes, firmas, renovaciones y actas" },
          { id: "living-cobros", nombre: "Cobros", descripcion: "Cánones del mes, facturas CYC y fianzas" },
          { id: "living-balcony", nombre: "Balcony PH", descripcion: "Administración, residentes, banco y balances de la PH" },
          { id: "living-comercial", nombre: "Comercial Living", descripcion: "Leads de la web" },
        ],
      },
    ],
  },
  {
    id: "cyc",
    nombre: "C&C Group",
    cuentas: [
      { id: "cyc-comercial", nombre: "comercial@" },
      { id: "cyc-contabilidad", nombre: "contabilidad@" },
    ],
    verticales: [
      {
        id: "cyc-general",
        nombre: "General",
        modulos: [
          { id: "cyc-hoy", nombre: "Hoy y Para aprobar", descripcion: "Pendientes, corridas y aprobaciones de C&C" },
          { id: "cyc-correo", nombre: "Correo", descripcion: "Bandeja ruteada y borradores con IA" },
          { id: "cyc-finanzas", nombre: "Finanzas C&C", descripcion: "Extractos, bancos, caja y referencias bancarias" },
          { id: "cyc-sistema", nombre: "Sistema", descripcion: "Corridas de C&C OS" },
        ],
      },
      {
        id: "cyc-obra",
        nombre: "Obra 54-47",
        modulos: [
          { id: "obra-actas", nombre: "Actas", descripcion: "Cortes, ítems y liquidación por contratista" },
          { id: "obra-pagos", nombre: "Pagos de obra", descripcion: "Pagos marcados HOY y sus soportes" },
          { id: "obra-contratistas", nombre: "Contratistas", descripcion: "Datos, contratos y anticipos" },
          { id: "obra-calidad", nombre: "Calidad", descripcion: "Pruebas de concreto" },
          { id: "obra-diseno", nombre: "Diseño y compras", descripcion: "Especificaciones, fachada, importación y medidas" },
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
