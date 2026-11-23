import type { GrupoNav } from "@/lib/modulos/registro";

export interface EmpresaShell {
  id: string;
  nombre: string;
  acento: string;
  logo: string | null;
  /** Adónde lleva elegirla desde el selector. */
  inicio: string;
}

/** Todo lo que el shell necesita, ya filtrado por permisos en el servidor. */
export interface DatosShell {
  plataforma: string;
  empresa: { id: string; nombre: string; acento: string; logo: string | null } | null;
  empresas: EmpresaShell[];
  /** "Todas" se ofrece en Hoy cuando hay más de una empresa. */
  todas: boolean;
  grupos: GrupoNav[];
  /** Módulos de todas sus empresas, para ⌘K. */
  modulosPorEmpresa: { empresa: string; nombre: string; grupos: GrupoNav[] }[];
  contadores: { hoy: number; aprobar: number; criticos: number };
  usuario: { correo: string; nombre: string; maestro: boolean };
  ajustes: boolean;
  asistente: boolean;
}
