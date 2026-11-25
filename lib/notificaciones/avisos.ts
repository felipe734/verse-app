import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { avisos, suscripcionesPush, tareas, usuarios } from "@/db/esquema";
import { filtrarSuyo, puede, puedeAprobar, type Sesion } from "@/lib/acceso/permisos";
import { sesionPorId } from "@/lib/acceso/sesion";
import { yaAprobada } from "@/lib/hoy/acciones";
import { esAprobar, esCritico, type TareaHoy } from "@/lib/hoy/clasificar";
import { HOY_POR_EMPRESA } from "@/lib/hoy/datos";
import { SISTEMA_POR_EMPRESA } from "@/lib/sistema/datos";

/**
 * Avisos de la entrega 3: críticos, aprobaciones y fallas, a quien tenga el módulo.
 * Cada aviso nace de una fila de TRAZABILIDAD y sale una sola vez por fila y motivo.
 */
export type TipoAviso = "critico" | "aprobar" | "falla";

export interface Aviso {
  clave: string;
  tipo: TipoAviso;
  recId: string | null;
  titulo: string;
  cuerpo: string;
  url: string;
  /** Quién puede recibirlo, según sus permisos. */
  para: (s: Sesion) => boolean;
}

export interface Suscripcion {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Envía un aviso a un dispositivo. Devuelve el estado HTTP del servicio de push. */
export type Enviar = (s: Suscripcion, carga: { titulo: string; cuerpo: string; url: string; etiqueta: string }) => Promise<number>;

const EMPRESA_APP: Record<string, string> = { Verse: "verse", "C&C": "cyc" };

/** Qué aviso corresponde a una fila de TRAZABILIDAD, si alguno. */
export function avisoDe(t: TareaHoy): Aviso | null {
  const empresa = EMPRESA_APP[t.empresa];
  if (!empresa) return null;
  const hoy = HOY_POR_EMPRESA[empresa]!;
  const primera = (t.detalle ?? "").split("\n")[0]!.replace(/^\s*(Crítico|Aprobar):\s*/, "");

  if (t.tipo === "Pendiente" && t.estado === "Abierto" && esAprobar(t) && !yaAprobada(t.detalle)) {
    return {
      clave: `aprobar:${t.recId}`,
      tipo: "aprobar",
      recId: t.recId,
      titulo: `Para aprobar · ${t.asunto ?? ""}`,
      cuerpo: primera,
      url: "/aprobar",
      para: (s) => puedeAprobar(s, empresa),
    };
  }
  if (t.tipo === "Pendiente" && (t.estado === "Abierto" || t.estado === "En espera") && esCritico(t)) {
    return {
      clave: `critico:${t.recId}`,
      tipo: "critico",
      recId: t.recId,
      titulo: `Crítico · ${t.asunto ?? ""}`,
      cuerpo: primera,
      url: `/hoy?empresa=${empresa}`,
      para: (s) => puede(s, empresa, hoy.modulo, "ver") && filtrarSuyo([t], s, empresa).length > 0,
    };
  }
  if (t.tipo === "Corrida" && (t.estado === "Falló" || t.estado === "Frenado")) {
    const modulo = SISTEMA_POR_EMPRESA[empresa]!;
    return {
      clave: `falla:${t.recId}`,
      tipo: "falla",
      recId: t.recId,
      titulo: `${t.estado} · ${t.asunto ?? ""}`,
      cuerpo: t.proceso ?? "",
      url: `/ajustes?vista=sistema&empresa=${empresa}`,
      para: (s) => puede(s, empresa, modulo, "ver"),
    };
  }
  return null;
}

/** Falla de la propia app (respaldo o sincronización), para quien ve Sistema de Verse. */
export function avisoDeFallaApp(clave: string, titulo: string, cuerpo: string): Aviso {
  return { clave: `falla-app:${clave}`, tipo: "falla", recId: null, titulo, cuerpo, url: "/ajustes?vista=sistema", para: (s) => puede(s, "verse", "verse-sistema", "ver") };
}

async function sesionesActivas(db: Db): Promise<Sesion[]> {
  const ids = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.estado, "activo"));
  const lista: Sesion[] = [];
  for (const { id } of ids) {
    const s = await sesionPorId(db, id);
    if (s) lista.push(s);
  }
  return lista;
}

/**
 * Envía los avisos nuevos. Cada uno sale una vez por fila y motivo; lo que nunca cambia no
 * avisa, así el atraso acumulado no despierta a nadie. Sin claves VAPID solo se registra.
 */
export async function enviarAvisos(db: Db, lista: Aviso[], enviar: Enviar | null): Promise<{ enviados: number; nuevos: number }> {
  if (!lista.length) return { enviados: 0, nuevos: 0 };

  let nuevos = 0;
  let enviados = 0;
  let sesiones: Sesion[] | null = null;
  for (const a of lista) {
    const insertado = await db
      .insert(avisos)
      .values({ clave: a.clave, tipo: a.tipo, recId: a.recId, sembrado: !enviar })
      .onConflictDoNothing()
      .returning({ clave: avisos.clave });
    if (!insertado.length || !enviar) continue;
    nuevos++;

    sesiones ??= await sesionesActivas(db);
    const destinatarios = sesiones.filter(a.para);
    let ok = 0;
    for (const s of destinatarios) {
      const subs = await db.select().from(suscripcionesPush).where(eq(suscripcionesPush.usuarioId, s.usuarioId));
      for (const sub of subs.filter((x) => x.activa)) {
        const estado = await enviar(sub, { titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, etiqueta: a.clave }).catch(() => 0);
        if (estado === 404 || estado === 410) {
          // El dispositivo ya no existe: se desactiva.
          await db.update(suscripcionesPush).set({ activa: false }).where(eq(suscripcionesPush.id, sub.id));
        } else if (estado >= 200 && estado < 300) {
          ok++;
          await db.update(suscripcionesPush).set({ ultimoEnvio: sql`now()` }).where(eq(suscripcionesPush.id, sub.id));
        }
      }
    }
    enviados += ok;
    await db.update(avisos).set({ destinatarios: destinatarios.length, enviados: ok }).where(eq(avisos.clave, a.clave));
  }
  return { enviados, nuevos };
}

/** Avisos para las filas que acaban de cambiar (las trae el webhook). */
export async function avisarCambios(db: Db, recIds: string[], enviar: Enviar | null) {
  if (!recIds.length) return { enviados: 0, nuevos: 0 };
  const filas = (await db.select().from(tareas).where(inArray(tareas.recId, recIds))) as unknown as TareaHoy[];
  return enviarAvisos(db, filas.map(avisoDe).filter((a): a is Aviso => a !== null), enviar);
}
