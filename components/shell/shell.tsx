import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { db } from "@/db/cliente";
import { sesionActual } from "@/lib/acceso/actual";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import { empresasVisibles } from "@/lib/acceso/permisos";
import { empresasDelAsistente } from "@/lib/asistente/herramientas";
import { PLATFORM_NAME } from "@/lib/config";
import { aprobacionesDe } from "@/lib/hoy/aprobar";
import { hoyDe } from "@/lib/hoy/datos";
import { inicioDe, navegacion, TODAS } from "@/lib/modulos/registro";
import { esVitrina } from "@/lib/vitrina/activa";
import { ShellCliente } from "./shell-cliente";
import type { DatosShell } from "./tipos";

async function salir() {
  "use server";
  await signOut({ redirectTo: "/entrar" });
}

/** Texto blanco o negro según el acento, para que el contraste sea AA. */
function sobreAcento(hex: string): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "#ffffff";
  const [r, g, b] = m.slice(1).map((x) => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#09090b" : "#ffffff";
}

/**
 * Shell de la app: arma en el servidor la barra lateral, los contadores y la búsqueda con
 * lo que la persona puede ver en la empresa de la URL. Nada sin permiso llega al cliente.
 */
export async function Shell({ empresa: pedida, children }: { empresa: string | null; children: React.ReactNode }) {
  const sesion = await sesionActual();
  const estructura = sesion.estructura ?? ESTRUCTURA;
  const visibles = empresasVisibles(sesion);
  const todas = visibles.length > 1;

  let empresa = pedida;
  if (empresa && empresa !== TODAS && !visibles.includes(empresa)) empresa = null;
  if (empresa === TODAS && !todas) empresa = null;
  if (pedida && !empresa) redirect(inicioDe(sesion, estructura, visibles) ?? "/sin-acceso");
  const activa = empresa ?? visibles[0] ?? null;

  const def = estructura.find((e) => e.id === activa);
  const grupos = activa ? navegacion(sesion, estructura, activa) : [];
  const deEmpresas = activa === TODAS ? visibles : activa ? [activa] : [];
  const [hoy, aprobaciones] = await Promise.all([hoyDe(db(), sesion, deEmpresas), aprobacionesDe(db(), sesion, deEmpresas)]);
  const porSeccion = Object.fromEntries(hoy.secciones.map((s) => [s.id, s.items.length]));

  const d: DatosShell = {
    plataforma: PLATFORM_NAME,
    empresa: def && activa !== TODAS ? { id: def.id, nombre: def.nombre, acento: def.acento ?? "#18181b", logo: def.logo ?? null } : null,
    empresas: visibles.map((id) => {
      const e = estructura.find((x) => x.id === id)!;
      return { id, nombre: e.nombre, acento: e.acento ?? "#18181b", logo: e.logo ?? null, inicio: inicioDe(sesion, estructura, [id]) ?? `/${id}` };
    }),
    todas,
    grupos,
    modulosPorEmpresa: visibles.map((id) => ({ empresa: id, nombre: estructura.find((x) => x.id === id)!.nombre, grupos: navegacion(sesion, estructura, id) })),
    contadores: {
      hoy: (porSeccion.critico ?? 0) + (porSeccion.vencido ?? 0) + (porSeccion.hoy ?? 0),
      criticos: porSeccion.critico ?? 0,
      aprobar: aprobaciones.filter((a) => !a.aprobadaEnApp && a.puedeResponder).length,
    },
    usuario: { correo: sesion.correo, nombre: sesion.nombreAirtable ?? sesion.correo.split("@")[0]!, maestro: sesion.maestro },
    ajustes: sesion.maestro,
    asistente: (Boolean(process.env.ANTHROPIC_API_KEY) || esVitrina()) && empresasDelAsistente(sesion).length > 0,
  };

  const acento = d.empresa?.acento ?? "#18181b";
  const abierta = (await cookies()).get("sidebar_state")?.value !== "false";
  return (
    <div style={{ "--acento": acento, "--acento-foreground": sobreAcento(acento) } as React.CSSProperties} className="contents">
      <ShellCliente d={d} acento={{ fondo: acento, texto: sobreAcento(acento) }} abierta={abierta} salir={salir}>
        {children}
      </ShellCliente>
    </div>
  );
}
