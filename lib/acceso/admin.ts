import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/cliente";
import { accesos, empresas, invitaciones, plantillas, usuarios, verticales } from "@/db/esquema";
import { auditar } from "@/lib/auditoria";
import { Casillas } from "./casillas";
import { ErrorAcceso, type Sesion } from "./permisos";

/**
 * Operaciones de Ajustes. Solo el Maestro; cada cambio queda en AUDITORIA con antes y después.
 */
export function exigirMaestro(s: Sesion | null): Sesion {
  if (!s || s.estado !== "activo" || !s.maestro) throw new ErrorAcceso("Solo el Maestro puede usar Ajustes");
  return s;
}

const DIAS_INVITACION = 7;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const DatosUsuario = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre"),
  correo: z.string().trim().toLowerCase().email("Correo inválido"),
  celular: z.string().trim().max(20).optional().transform((v) => v || null),
  nombreAirtable: z.string().trim().max(60).optional().transform((v) => v || null),
});

export async function listarUsuarios(db: Db, s: Sesion) {
  exigirMaestro(s);
  const us = await db.select().from(usuarios).orderBy(asc(usuarios.nombre));
  const as = await db.select({ usuarioId: accesos.usuarioId, empresaId: accesos.empresaId, plantillaId: accesos.plantillaId }).from(accesos);
  return us.map((u) => ({ ...u, accesos: as.filter((a) => a.usuarioId === u.id) }));
}

export async function crearUsuario(db: Db, s: Sesion, datos: z.input<typeof DatosUsuario>): Promise<string> {
  exigirMaestro(s);
  const d = DatosUsuario.parse(datos);
  const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(sql`lower(${usuarios.correo})`, d.correo));
  if (existe) throw new Error("Ya existe un usuario con ese correo");
  const [u] = await db.insert(usuarios).values({ ...d, estado: "invitado" }).returning();
  await auditar(db, { autor: s.correo, accion: "acceso.usuario_creado", despues: d });
  return u!.id;
}

export async function actualizarUsuario(db: Db, s: Sesion, id: string, datos: z.input<typeof DatosUsuario>): Promise<void> {
  exigirMaestro(s);
  const d = DatosUsuario.parse(datos);
  const [antes] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  if (!antes) throw new Error("Usuario no encontrado");
  await db.update(usuarios).set(d).where(eq(usuarios.id, id));
  await auditar(db, {
    autor: s.correo,
    accion: "acceso.usuario_editado",
    antes: { nombre: antes.nombre, correo: antes.correo, celular: antes.celular, nombreAirtable: antes.nombreAirtable },
    despues: d,
  });
}

/** Suspender corta el acceso al instante sin borrar su historial. */
export async function cambiarEstado(db: Db, s: Sesion, id: string, estado: "activo" | "suspendido"): Promise<void> {
  exigirMaestro(s);
  if (id === s.usuarioId) throw new Error("No puedes suspenderte a ti mismo");
  const [antes] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  if (!antes) throw new Error("Usuario no encontrado");
  // Reactivar a alguien que nunca entró lo deja invitado: debe usar su enlace.
  const nuevo = estado === "activo" && !antes.ultimoIngreso ? "invitado" : estado;
  await db.update(usuarios).set({ estado: nuevo }).where(eq(usuarios.id, id));
  await auditar(db, { autor: s.correo, accion: `acceso.${estado === "suspendido" ? "suspendido" : "reactivado"}`, antes: { estado: antes.estado }, despues: { estado: nuevo, correo: antes.correo } });
}

export async function guardarAcceso(
  db: Db,
  s: Sesion,
  usuarioId: string,
  empresaId: string,
  cambio: { plantillaId?: string | null; casillas?: Casillas },
): Promise<void> {
  exigirMaestro(s);
  const [empresa] = await db.select().from(empresas).where(eq(empresas.id, empresaId));
  if (!empresa) throw new Error("Empresa desconocida");
  let casillas: Casillas;
  let plantillaId: string | null = cambio.plantillaId ?? null;
  if (cambio.plantillaId) {
    const [p] = await db.select().from(plantillas).where(eq(plantillas.id, cambio.plantillaId));
    if (!p || p.empresaId !== empresaId) throw new Error("La plantilla no es de esta empresa");
    casillas = Casillas.parse(p.casillas);
  } else if (cambio.casillas) {
    casillas = Casillas.parse(cambio.casillas);
    plantillaId = null;
  } else throw new Error("Nada que guardar");

  const [antes] = await db.select().from(accesos).where(and(eq(accesos.usuarioId, usuarioId), eq(accesos.empresaId, empresaId)));
  await db
    .insert(accesos)
    .values({ usuarioId, empresaId, plantillaId, casillas })
    .onConflictDoUpdate({ target: [accesos.usuarioId, accesos.empresaId], set: { plantillaId, casillas, actualizado: sql`now()` } });
  await auditar(db, {
    autor: s.correo,
    accion: "acceso.casillas",
    detalle: `${usuarioId} · ${empresaId}${plantillaId ? ` · plantilla ${plantillaId}` : ""}`,
    antes: antes ? (antes.casillas as Record<string, unknown>) : null,
    despues: casillas as Record<string, unknown>,
  });
}

export async function quitarAcceso(db: Db, s: Sesion, usuarioId: string, empresaId: string): Promise<void> {
  exigirMaestro(s);
  const [antes] = await db.select().from(accesos).where(and(eq(accesos.usuarioId, usuarioId), eq(accesos.empresaId, empresaId)));
  if (!antes) return;
  await db.delete(accesos).where(and(eq(accesos.usuarioId, usuarioId), eq(accesos.empresaId, empresaId)));
  await auditar(db, { autor: s.correo, accion: "acceso.quitado", detalle: `${usuarioId} · ${empresaId}`, antes: antes.casillas as Record<string, unknown> });
}

/** Devuelve el enlace una sola vez; en la base solo queda su hash. Vence en 7 días. */
export async function crearInvitacion(db: Db, s: Sesion, usuarioId: string, ahora = new Date()): Promise<{ token: string; vence: Date }> {
  exigirMaestro(s);
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId));
  if (!u) throw new Error("Usuario no encontrado");
  if (u.estado === "suspendido") throw new Error("Reactiva al usuario antes de invitarlo");
  const token = randomBytes(32).toString("base64url");
  const vence = new Date(ahora.getTime() + DIAS_INVITACION * 24 * 3600_000);
  await db.insert(invitaciones).values({ hash: hashToken(token), usuarioId, vence });
  await auditar(db, { autor: s.correo, accion: "acceso.invitacion", despues: { correo: u.correo, vence: vence.toISOString() } });
  return { token, vence };
}

export type EstadoInvitacion = { valida: true; usuarioId: string; nombre: string; correo: string } | { valida: false; motivo: "no-existe" | "vencida" | "usada" | "suspendido" };

export async function revisarInvitacion(db: Db, token: string, ahora = new Date()): Promise<EstadoInvitacion> {
  const [inv] = await db.select().from(invitaciones).where(eq(invitaciones.hash, hashToken(token)));
  if (!inv) return { valida: false, motivo: "no-existe" };
  if (inv.usada) return { valida: false, motivo: "usada" };
  if (inv.vence.getTime() < ahora.getTime()) return { valida: false, motivo: "vencida" };
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, inv.usuarioId));
  if (!u || u.estado === "suspendido") return { valida: false, motivo: "suspendido" };
  return { valida: true, usuarioId: u.id, nombre: u.nombre, correo: u.correo };
}

/**
 * Usa la invitación al entrar con Google: el correo de Google debe coincidir con el invitado.
 * Activa al usuario y marca la invitación como usada.
 */
export async function usarInvitacion(db: Db, token: string, correoGoogle: string, ahora = new Date()): Promise<boolean> {
  const r = await revisarInvitacion(db, token, ahora);
  if (!r.valida || r.correo.toLowerCase() !== correoGoogle.trim().toLowerCase()) return false;
  const usadas = await db
    .update(invitaciones)
    .set({ usada: sql`now()` })
    .where(and(eq(invitaciones.hash, hashToken(token)), isNull(invitaciones.usada)))
    .returning();
  if (!usadas.length) return false;
  await db.update(usuarios).set({ estado: "activo" }).where(and(eq(usuarios.id, r.usuarioId), eq(usuarios.estado, "invitado")));
  await auditar(db, { autor: r.correo, accion: "acceso.invitacion_usada" });
  return true;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export async function crearEmpresa(db: Db, s: Sesion, nombre: string): Promise<string> {
  exigirMaestro(s);
  const n = nombre.trim();
  const id = slug(n);
  if (n.length < 2 || !id) throw new Error("Escribe el nombre de la empresa");
  const [existe] = await db.select().from(empresas).where(eq(empresas.id, id));
  if (existe) throw new Error("Ya existe esa empresa");
  const [{ orden } = { orden: 0 }] = await db.select({ orden: sql<number>`coalesce(max(${empresas.orden}), -1) + 1` }).from(empresas);
  await db.insert(empresas).values({ id, nombre: n, orden });
  await db.insert(verticales).values({ id: `${id}-general`, empresaId: id, nombre: "General", orden: 0 });
  await auditar(db, { autor: s.correo, accion: "estructura.empresa_creada", despues: { id, nombre: n } });
  return id;
}

export async function crearVertical(db: Db, s: Sesion, empresaId: string, nombre: string): Promise<string> {
  exigirMaestro(s);
  const n = nombre.trim();
  const [empresa] = await db.select().from(empresas).where(eq(empresas.id, empresaId));
  if (!empresa) throw new Error("Empresa desconocida");
  const id = `${empresaId}-${slug(n)}`;
  if (n.length < 2 || id === `${empresaId}-`) throw new Error("Escribe el nombre de la vertical");
  const [existe] = await db.select().from(verticales).where(eq(verticales.id, id));
  if (existe) throw new Error("Ya existe esa vertical");
  const [{ orden } = { orden: 0 }] = await db
    .select({ orden: sql<number>`coalesce(max(${verticales.orden}), -1) + 1` })
    .from(verticales)
    .where(eq(verticales.empresaId, empresaId));
  await db.insert(verticales).values({ id, empresaId, nombre: n, orden });
  await auditar(db, { autor: s.correo, accion: "estructura.vertical_creada", despues: { id, empresaId, nombre: n } });
  return id;
}
