import { sumarMeses } from "./letras";

/** Tipos y datos de los modelos que también usa el formulario (sin el texto de los modelos). */

export const MODELOS = {
  "vl-vivienda-living": { nombre: "Apartamento Verse Living 54", edificio: "Verse Living" },
  "vl-vivienda-balcony": { nombre: "Apartamento Edificio Balcony", edificio: "Edificio Balcony" },
  "vl-coliving": { nombre: "Habitación coliving Verse Living 54", edificio: "Verse Living" },
} as const;

export type ModeloId = keyof typeof MODELOS;

export const TIPOS_DOC = { CC: "C.C.", CE: "C.E.", PPT: "P.P.T.", PASSPORT: "Pasaporte" } as const;
export type TipoDoc = keyof typeof TIPOS_DOC;

export interface DatosContrato {
  modelo: ModeloId;
  nombre: string;
  tipoDoc: TipoDoc;
  numeroDoc: string;
  lugarExpedicion?: string;
  correo: string;
  whatsapp: string;
  /** Número de apartamento o de habitación. */
  numero: string;
  /** Texto del parqueadero; vacío = "No aplica" (en Balcony, sin fila). */
  parqueadero?: string;
  inicio: string;
  meses: number;
  canon: number;
  admin?: number;
  referenciaPago?: string;
  matricula?: string;
  contadorEnel?: string;
  contratoEaab?: string;
  diasPreaviso?: number;
}

export function fin(d: Pick<DatosContrato, "inicio" | "meses">): string {
  return sumarMeses(d.inicio, d.meses);
}
