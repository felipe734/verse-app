import Link from "next/link";
import { Marco } from "@/components/marco";

/** Inicio público: explica para qué es la app y enlaza la política de privacidad (lo pide Google). */
export default function Inicio() {
  return (
    <Marco rotulo="HERRAMIENTA INTERNA" titulo="Verse App">
      <p>
        Verse App es la aplicación interna de Verse Group y C&amp;C Group. Reúne en un solo lugar, en el celular y en el computador,
        la operación que hoy vive en Airtable: pendientes del día, aprobaciones, reservas y limpiezas de Verse Host, contratos y
        cobros de Verse Living, y la obra del edificio 54-47 de C&amp;C.
      </p>
      <div className="space-y-2">
        <h2 className="font-display text-lg font-medium text-foreground">Para qué sirve</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Ver y cerrar los pendientes de cada persona según su rol.</li>
          <li>Aprobar cambios propuestos y dejar rastro de quién hizo qué.</li>
          <li>Consultar la operación sin abrir varias bases de Airtable.</li>
          <li>Respaldar cada noche los datos de la empresa en Google Drive.</li>
        </ul>
      </div>
      <div className="space-y-2">
        <h2 className="font-display text-lg font-medium text-foreground">Quién puede entrar</h2>
        <p>
          Solo las personas que la empresa invita, con su cuenta de Google. Cada una ve únicamente lo que su rol permite. Para saber
          qué datos usa la app y para qué, lee la{" "}
          <Link className="text-[var(--verse-azul)] underline" href="/privacidad">
            política de privacidad
          </Link>
          .
        </p>
      </div>
    </Marco>
  );
}
