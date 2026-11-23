import { after } from "next/server";
import { db } from "@/db/cliente";
import { CATALOGO } from "@/lib/airtable/mapeo";
import { auditar } from "@/lib/auditoria";
import { crearContador, diaBogota } from "@/lib/medicion/contador";
import { prepararDia, procesarDia } from "@/lib/respaldo/correr";
import { clienteServidor, esCronAutorizado, urlProduccion } from "@/lib/servidor/airtable";
import { driveRespaldo } from "@/lib/servidor/google";

export const maxDuration = 300;

const PRESUPUESTO_MS = 230_000;
const MAX_VUELTAS = 40;

/**
 * Respaldo nocturno de Airtable a Drive (2:30 Bogotá). Si no alcanza el tiempo,
 * se vuelve a llamar a sí misma hasta terminar.
 */
export async function GET(request: Request) {
  if (!esCronAutorizado(request)) return new Response("No autorizado", { status: 401 });

  const url = new URL(request.url);
  const vuelta = Number(url.searchParams.get("vuelta") ?? "0");
  const fecha = url.searchParams.get("fecha") ?? diaBogota();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return new Response("Fecha inválida", { status: 400 });

  const base = db();
  const contador = crearContador();
  const { drive, idUnidad } = driveRespaldo();

  try {
    if (vuelta === 0) await prepararDia(base, fecha, CATALOGO);
    const r = await procesarDia({ db: base, airtable: clienteServidor(contador), drive, idUnidad }, fecha, PRESUPUESTO_MS);
    const llamadas = contador.total();
    await contador.volcar(base);
    console.info("[cron/respaldo]", JSON.stringify({ fecha, vuelta, ...r, llamadas }));

    if (!r.terminado && vuelta < MAX_VUELTAS) {
      // Por el dominio público: la URL del despliegue está detrás del inicio de sesión de Vercel.
      const siguiente = new URL(urlProduccion("/api/cron/respaldo"));
      siguiente.searchParams.set("vuelta", String(vuelta + 1));
      siguiente.searchParams.set("fecha", fecha);
      const autorizacion = request.headers.get("authorization") ?? "";
      after(async () => {
        const r = await fetch(siguiente, { headers: { authorization: autorizacion } }).catch((e: unknown) => e);
        if (!(r instanceof Response) || !r.ok) {
          console.error("[cron/respaldo] no se pudo encadenar la vuelta", vuelta + 1, r instanceof Response ? r.status : "sin respuesta");
        }
      });
    }
    if (r.terminado) {
      await auditar(base, { autor: "sistema", accion: "respaldo.terminado", detalle: JSON.stringify({ fecha, ...r }) });
    }
    return Response.json({ fecha, vuelta, ...r });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "error";
    console.error("[cron/respaldo]", fecha, vuelta, mensaje);
    await auditar(base, { autor: "sistema", accion: "respaldo.error", detalle: mensaje });
    return Response.json({ fecha, vuelta, error: mensaje }, { status: 500 });
  }
}
