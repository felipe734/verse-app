import { db } from "@/db/cliente";
import { estaEnLaApp } from "@/lib/airtable/definicion";
import { CATALOGO } from "@/lib/airtable/mapeo";
import { auditar } from "@/lib/auditoria";
import { restaurar } from "@/lib/respaldo/restaurar";
import { clienteServidor, esCronAutorizado } from "@/lib/servidor/airtable";
import { driveRespaldo } from "@/lib/servidor/google";

export const maxDuration = 300;

/**
 * Restaura una tabla de un respaldo a una tabla NUEVA ("RESTAURADA AAAA-MM-DD · tabla").
 * Solo a pedido de Felipe, con la clave del cron. Nunca escribe sobre lo vivo.
 * Cuerpo: { "fecha": "2026-11-22", "base": "9. VERSE OS", "tabla": "C0. LEAD GEN" }
 */
export async function POST(request: Request) {
  if (!esCronAutorizado(request)) return new Response("No autorizado", { status: 401 });
  const cuerpo = (await request.json().catch(() => null)) as { fecha?: string; base?: string; tabla?: string } | null;
  const { fecha, base, tabla } = cuerpo ?? {};
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !base || !tabla) {
    return new Response("Faltan fecha, base o tabla", { status: 400 });
  }
  const fila = CATALOGO.find((f) => f.base === base && f.tabla === tabla);
  if (!fila || !estaEnLaApp(base)) return new Response("Esa tabla no está en el catálogo de la app", { status: 404 });

  const conexion = db();
  const { drive, idUnidad } = driveRespaldo();
  try {
    const r = await restaurar(
      { db: conexion, airtable: clienteServidor(), drive, idUnidad },
      { fecha, base, tabla, idBase: fila.idBase },
    );
    await auditar(conexion, {
      autor: "felipe",
      accion: "respaldo.restaurado",
      idBase: fila.idBase,
      idTabla: r.idTabla,
      detalle: JSON.stringify({ fecha, base, origen: tabla, restaurada: r.tabla, filas: r.filas }),
    });
    console.info("[respaldo/restaurar]", JSON.stringify({ fecha, base, origen: tabla, restaurada: r.tabla, filas: r.filas }));
    return Response.json(r);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "error";
    console.error("[respaldo/restaurar]", mensaje);
    return Response.json({ error: mensaje }, { status: 500 });
  }
}
