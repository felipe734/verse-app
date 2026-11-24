import { Casillas } from "./casillas";
import { empresaBase, modulosDe } from "./estructura";

/**
 * Plantillas de arranque (doc del plan, "Plantillas"). Llenan las casillas de un clic;
 * después se ajustan una por una en Ajustes.
 *
 * Donde el doc no fija un nivel se tomó lo siguiente (ajustable en Ajustes):
 * - Correo sin nivel explícito: "enviar" para Administrador Verse, "redactar" para las demás.
 * - Aprobar, Descargar y Asistente: apagados; solo el Maestro los tiene hasta que Felipe decida.
 * - Hoy se marca "editar" (cerrar y aplazar), con alcance "todo" o "suyo" según la plantilla.
 */
export interface Plantilla {
  id: string;
  nombre: string;
  empresa: string;
  casillas: Casillas;
}

const todos = <T>(ids: string[], valor: T) => Object.fromEntries(ids.map((id) => [id, valor]));

const verse = empresaBase("verse");
const cyc = empresaBase("cyc");

export const PLANTILLAS: Plantilla[] = [
  {
    id: "administrador-verse",
    nombre: "Administrador Verse",
    empresa: "verse",
    casillas: Casillas.parse({
      modulos: {
        "verse-hoy": "editar",
        "verse-correo": "editar",
        "verse-finanzas": "ver",
        "verse-sistema": "ver",
        ...todos(modulosDe(verse, "verse-host"), "editar"),
        ...todos(modulosDe(verse, "verse-living"), "editar"),
      },
      alcanceHoy: "todo",
      correo: { "verse-contabilidad": "enviar", "verse-contacto": "enviar" },
      cifras: todos(["verse-general", "verse-host", "verse-living"], true),
      codigos: todos(["verse-general", "verse-host", "verse-living"], "siempre"),
      terceros: todos(["verse-general", "verse-host", "verse-living"], true),
    }),
  },
  {
    id: "coordinacion-aseo",
    nombre: "Coordinación de aseo",
    empresa: "verse",
    casillas: Casillas.parse({
      modulos: {
        "verse-hoy": "editar",
        "host-limpiezas": "editar",
        "host-ruta": "editar",
        "host-tickets": "editar",
        "host-operacion": "ver",
        "host-unidades": "ver",
      },
      alcanceHoy: "suyo",
      codigos: { "verse-host": "siempre" },
    }),
  },
  {
    id: "living",
    nombre: "Living",
    empresa: "verse",
    casillas: Casillas.parse({
      modulos: { "verse-hoy": "editar", "verse-correo": "editar", ...todos(modulosDe(verse, "verse-living"), "editar") },
      alcanceHoy: "suyo",
      correo: { "verse-contacto": "redactar" },
      cifras: { "verse-living": true },
      terceros: { "verse-living": true },
    }),
  },
  {
    id: "comercial",
    nombre: "Comercial",
    empresa: "verse",
    casillas: Casillas.parse({
      modulos: { "verse-hoy": "editar", "verse-correo": "editar", "host-comercial": "editar", "living-comercial": "editar" },
      alcanceHoy: "suyo",
      correo: { "verse-contacto": "redactar" },
      // "Solo datos de leads": ve contactos, pero solo tiene los módulos comerciales.
      terceros: { "verse-host": true, "verse-living": true },
    }),
  },
  {
    id: "aseo",
    nombre: "Aseo",
    empresa: "verse",
    casillas: Casillas.parse({
      modulos: { "host-ruta": "editar" },
      alcanceHoy: "suyo",
      codigos: { "verse-host": "turno" },
    }),
  },
  {
    id: "obra",
    nombre: "Obra",
    empresa: "cyc",
    casillas: Casillas.parse({
      modulos: { "cyc-hoy": "editar", "cyc-correo": "editar", ...todos(modulosDe(cyc, "cyc-obra"), "editar") },
      alcanceHoy: "suyo",
      correo: { "cyc-comercial": "redactar" },
      cifras: { "cyc-obra": true },
      terceros: { "cyc-obra": true },
    }),
  },
];

export function plantilla(id: string): Plantilla {
  const p = PLANTILLAS.find((x) => x.id === id);
  if (!p) throw new Error(`Plantilla desconocida: ${id}`);
  return p;
}
