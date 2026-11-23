/** Una fila de TRAZABILIDAD lista para la pantalla (ya filtrada por permisos en el servidor). */
export interface FilaVista {
  recId: string;
  empresa: "Verse" | "C&C";
  numero: number | null;
  asunto: string | null;
  accion: string;
  resto: string;
  estado: string | null;
  responsable: string | null;
  fechaLimite: string | null;
  proceso: string | null;
  linea: string | null;
  link: string | null;
  critico: boolean;
  atraso: number;
  etiqueta: string | null;
  puedeEditar: boolean;
  urlAirtable: string;
  urlCorrida: string | null;
}
