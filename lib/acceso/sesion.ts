import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/cliente";
import { accesos, empresas, modulos, usuarios, verticales } from "@/db/esquema";
import { Casillas } from "./casillas";
import type { EmpresaBase } from "./estructura";
import type { Sesion } from "./permisos";

/** Estructura vigente desde Postgres (empresas, verticales y módulos editables en Ajustes). */
export async function estructuraDe(db: Db): Promise<EmpresaBase[]> {
  const es = await db.select().from(empresas).orderBy(asc(empresas.orden), asc(empresas.nombre));
  const vs = await db.select().from(verticales).orderBy(asc(verticales.orden), asc(verticales.nombre));
  const ms = await db.select().from(modulos).orderBy(asc(modulos.orden), asc(modulos.nombre));
  return es.map((e) => ({
    id: e.id,
    nombre: e.nombre,
    cuentas: e.cuentas,
    verticales: vs
      .filter((v) => v.empresaId === e.id)
      .map((v) => ({
        id: v.id,
        nombre: v.nombre,
        modulos: ms.filter((m) => m.verticalId === v.id).map((m) => ({ id: m.id, nombre: m.nombre, descripcion: m.descripcion })),
      })),
  }));
}

async function armar(db: Db, u: typeof usuarios.$inferSelect): Promise<Sesion> {
  const filas = await db.select().from(accesos).where(eq(accesos.usuarioId, u.id));
  return {
    usuarioId: u.id,
    correo: u.correo,
    estado: u.estado,
    maestro: u.maestro,
    nombreAirtable: u.nombreAirtable,
    accesos: Object.fromEntries(filas.map((a) => [a.empresaId, Casillas.parse(a.casillas)])),
    estructura: await estructuraDe(db),
  };
}

/**
 * Arma la sesión desde Postgres en cada petición, así un cambio de casillas o una
 * suspensión aplica en la siguiente acción del usuario.
 */
export async function sesionDe(db: Db, correo: string): Promise<Sesion | null> {
  const [u] = await db.select().from(usuarios).where(eq(sql`lower(${usuarios.correo})`, correo.trim().toLowerCase()));
  return u ? armar(db, u) : null;
}

export async function sesionPorId(db: Db, id: string): Promise<Sesion | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [u] = await db.select().from(usuarios).where(eq(usuarios.id, id));
  return u ? armar(db, u) : null;
}
