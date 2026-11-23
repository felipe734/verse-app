import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db/cliente";
import { respaldos, respaldoTareas } from "@/db/esquema";
import { CATALOGO } from "@/lib/airtable/mapeo";
import { auditar } from "@/lib/auditoria";
import { registrarCorrida } from "@/lib/corridas";
import { detalleRespaldo } from "@/lib/corridas-texto";
import { crearContador, diaBogota } from "@/lib/medicion/contador";
import { avisoDeFallaApp, enviarAvisos } from "@/lib/notificaciones/avisos";
import { enviarWebPush } from "@/lib/notificaciones/webpush";
import { prepararDia, procesarDia } from "@/lib/respaldo/correr";
import { clienteServidor, esCronAutorizado, urlProduccion } from "@/lib/servidor/airtable";
import { driveRespaldo } from "@/lib/servidor/google";

export const maxDuration = 300;

const PRESUPUESTO_MS = 230_000;
const MAX_VUELTAS = 40;

const errorTexto = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Respaldo nocturno de Airtable a Drive (2:30 Bogotá). Si no alcanza el tiempo,
 * se vuelve a llamar a sí misma hasta terminar. Al terminar deja la Corrida "Respaldo"
 * (solo con CORRIDAS_ACTIVAS=1).
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
  const pendiente = { asunto: "Respaldo de Airtable por revisar", accion: `Revisar el respaldo de Airtable del ${fecha}`, fechaLimite: diaBogota() };

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
        const res = await fetch(siguiente, { headers: { authorization: autorizacion } }).catch((e: unknown) => e);
        if (!(res instanceof Response) || !res.ok) {
          console.error("[cron/respaldo] no se pudo encadenar la vuelta", vuelta + 1, res instanceof Response ? res.status : "sin respuesta");
        }
      });
    }

    if (r.terminado) {
      await auditar(base, { autor: "sistema", accion: "respaldo.terminado", detalle: JSON.stringify({ fecha, ...r }) });
      const [dia] = await base.select().from(respaldos).where(eq(respaldos.fecha, fecha));
      const fallidas = await base
        .select({ base: respaldoTareas.base, tabla: respaldoTareas.tabla, error: respaldoTareas.error })
        .from(respaldoTareas)
        .where(and(eq(respaldoTareas.fecha, fecha), eq(respaldoTareas.estado, "fallida")));
      if (dia) {
        await registrarCorrida(base, clienteServidor(), {
          proceso: "Respaldo",
          asunto: dia.fallidas > 0 ? "Respaldo de Airtable con fallas" : "Respaldo de Airtable completo",
          estado: dia.fallidas > 0 ? "Con pendientes" : "OK",
          detalle: detalleRespaldo(dia, fallidas.map((f) => `${f.base} / ${f.tabla}: ${f.error ?? "error"}`)),
          link: dia.carpetaId ? `https://drive.google.com/drive/folders/${dia.carpetaId}` : undefined,
          mes: fecha.slice(0, 7),
          pendiente,
        }).catch((e: unknown) => console.error("[cron/respaldo] corrida", errorTexto(e)));
      }
    }
    return Response.json({ fecha, vuelta, ...r });
  } catch (e) {
    const mensaje = errorTexto(e);
    console.error("[cron/respaldo]", fecha, vuelta, mensaje);
    await auditar(base, { autor: "sistema", accion: "respaldo.error", detalle: mensaje });
    await enviarAvisos(base, [avisoDeFallaApp(`respaldo:${fecha}`, "Falló el respaldo de Airtable", mensaje)], enviarWebPush()).catch(() => undefined);
    await registrarCorrida(base, clienteServidor(), {
      proceso: "Respaldo",
      asunto: "Respaldo de Airtable falló",
      estado: "Falló",
      detalle: `Encontró: el respaldo del ${fecha} se cayó en la vuelta ${vuelta}: ${mensaje}\nHizo: nada; el respaldo se puede volver a correr`,
      mes: fecha.slice(0, 7),
      pendiente,
    }).catch((err: unknown) => console.error("[cron/respaldo] corrida", errorTexto(err)));
    return Response.json({ fecha, vuelta, error: mensaje }, { status: 500 });
  }
}
