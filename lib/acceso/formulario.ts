import { Casillas, NivelAsistente, NivelCodigos, NivelCorreo, NivelModulo } from "./casillas";
import type { EmpresaBase } from "./estructura";

/**
 * Convierte el formulario de casillas de Ajustes en Casillas válidas.
 * Solo se leen módulos, cuentas y verticales de la empresa: lo demás se ignora.
 * Nombres: m:<modulo>, c:<cuenta>, cif:<vertical>, ter:<vertical>, cod:<vertical>,
 * alcance, aprobar, descargar, asistente.
 */
export function casillasDesdeFormulario(datos: { get(nombre: string): unknown }, empresa: EmpresaBase): Casillas {
  const texto = (k: string) => {
    const v = datos.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const marcado = (k: string) => texto(k) === "on";
  const de = <T>(esquema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, v: unknown, porDefecto: T): T => {
    const r = esquema.safeParse(v);
    return r.success ? r.data : porDefecto;
  };

  const modulos: Record<string, ReturnType<typeof NivelModulo.parse>> = {};
  for (const v of empresa.verticales) for (const m of v.modulos) {
    const n = de(NivelModulo, texto(`m:${m.id}`), "sin");
    if (n !== "sin") modulos[m.id] = n;
  }
  const correo: Record<string, ReturnType<typeof NivelCorreo.parse>> = {};
  for (const c of empresa.cuentas) {
    const n = de(NivelCorreo, texto(`c:${c.id}`), "sin");
    if (n !== "sin") correo[c.id] = n;
  }
  const cifras: Record<string, boolean> = {};
  const terceros: Record<string, boolean> = {};
  const codigos: Record<string, ReturnType<typeof NivelCodigos.parse>> = {};
  for (const v of empresa.verticales) {
    if (marcado(`cif:${v.id}`)) cifras[v.id] = true;
    if (marcado(`ter:${v.id}`)) terceros[v.id] = true;
    const n = de(NivelCodigos, texto(`cod:${v.id}`), "nunca");
    if (n !== "nunca") codigos[v.id] = n;
  }

  return Casillas.parse({
    modulos,
    alcanceHoy: texto("alcance") === "todo" ? "todo" : "suyo",
    aprobar: marcado("aprobar"),
    correo,
    cifras,
    codigos,
    terceros,
    descargar: marcado("descargar"),
    asistente: de(NivelAsistente, texto("asistente"), "no"),
  });
}
