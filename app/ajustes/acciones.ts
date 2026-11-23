"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import {
  actualizarUsuario,
  cambiarEstado,
  crearEmpresa,
  crearInvitacion,
  crearUsuario,
  crearVertical,
  exigirMaestro,
  guardarAcceso,
  quitarAcceso,
} from "@/lib/acceso/admin";
import { casillasDesdeFormulario } from "@/lib/acceso/formulario";
import { estructuraDe } from "@/lib/acceso/sesion";
import { urlProduccion } from "@/lib/servidor/airtable";

export interface Resultado {
  ok: boolean;
  mensaje: string;
  enlace?: string;
}

const texto = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : "";
};

async function maestro() {
  return exigirMaestro(await sesionActual());
}

const falla = (e: unknown): Resultado => ({ ok: false, mensaje: e instanceof Error ? e.message.split("\n")[0]! : "No se pudo guardar" });

export async function crearUsuarioAccion(_: Resultado | null, f: FormData): Promise<Resultado> {
  let id: string;
  try {
    const s = await maestro();
    id = await crearUsuario(db(), s, { nombre: texto(f, "nombre"), correo: texto(f, "correo"), celular: texto(f, "celular"), nombreAirtable: texto(f, "nombreAirtable") });
  } catch (e) {
    return falla(e);
  }
  redirect(`/ajustes/usuarios/${id}`);
}

export async function editarUsuarioAccion(id: string, _: Resultado | null, f: FormData): Promise<Resultado> {
  try {
    const s = await maestro();
    await actualizarUsuario(db(), s, id, { nombre: texto(f, "nombre"), correo: texto(f, "correo"), celular: texto(f, "celular"), nombreAirtable: texto(f, "nombreAirtable") });
    revalidatePath(`/ajustes/usuarios/${id}`);
    return { ok: true, mensaje: "Datos guardados" };
  } catch (e) {
    return falla(e);
  }
}

export async function plantillaAccion(usuarioId: string, empresaId: string, _: Resultado | null, f: FormData): Promise<Resultado> {
  try {
    const s = await maestro();
    const plantillaId = texto(f, "plantilla");
    if (!plantillaId) return { ok: false, mensaje: "Elige una plantilla" };
    await guardarAcceso(db(), s, usuarioId, empresaId, { plantillaId });
    revalidatePath(`/ajustes/usuarios/${usuarioId}`);
    return { ok: true, mensaje: "Plantilla aplicada" };
  } catch (e) {
    return falla(e);
  }
}

export async function casillasAccion(usuarioId: string, empresaId: string, _: Resultado | null, f: FormData): Promise<Resultado> {
  try {
    const s = await maestro();
    const empresa = (await estructuraDe(db())).find((e) => e.id === empresaId);
    if (!empresa) return { ok: false, mensaje: "Empresa desconocida" };
    await guardarAcceso(db(), s, usuarioId, empresaId, { casillas: casillasDesdeFormulario(f, empresa) });
    revalidatePath(`/ajustes/usuarios/${usuarioId}`);
    return { ok: true, mensaje: "Casillas guardadas" };
  } catch (e) {
    return falla(e);
  }
}

export async function quitarAccesoAccion(usuarioId: string, empresaId: string): Promise<void> {
  const s = await maestro();
  await quitarAcceso(db(), s, usuarioId, empresaId);
  revalidatePath(`/ajustes/usuarios/${usuarioId}`);
}

export async function estadoAccion(usuarioId: string, estado: "activo" | "suspendido"): Promise<void> {
  const s = await maestro();
  await cambiarEstado(db(), s, usuarioId, estado);
  revalidatePath(`/ajustes/usuarios/${usuarioId}`);
  revalidatePath("/ajustes");
}

export async function invitarAccion(usuarioId: string): Promise<Resultado> {
  try {
    const s = await maestro();
    const { token, vence } = await crearInvitacion(db(), s, usuarioId);
    const fecha = vence.toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" });
    return { ok: true, mensaje: `Enlace listo. Vence el ${fecha}. Cópialo ahora: no se vuelve a mostrar.`, enlace: urlProduccion(`/invitacion/${token}`) };
  } catch (e) {
    return falla(e);
  }
}

export async function crearEmpresaAccion(_: Resultado | null, f: FormData): Promise<Resultado> {
  try {
    const s = await maestro();
    await crearEmpresa(db(), s, texto(f, "nombre"));
    revalidatePath("/ajustes");
    return { ok: true, mensaje: "Empresa creada con su vertical General" };
  } catch (e) {
    return falla(e);
  }
}

export async function crearVerticalAccion(_: Resultado | null, f: FormData): Promise<Resultado> {
  try {
    const s = await maestro();
    await crearVertical(db(), s, texto(f, "empresa"), texto(f, "nombre"));
    revalidatePath("/ajustes");
    return { ok: true, mensaje: "Vertical creada" };
  } catch (e) {
    return falla(e);
  }
}
