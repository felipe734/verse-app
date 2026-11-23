import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Campo, estiloEntrada, Forma } from "@/components/ajustes/forma";
import { Encabezado, Seccion, Tarjeta } from "@/components/ajustes/encabezado";
import { db } from "@/db/cliente";
import { plantillas } from "@/db/esquema";
import { sesionActual } from "@/lib/acceso/actual";
import { listarUsuarios } from "@/lib/acceso/admin";
import { crearEmpresaAccion, crearUsuarioAccion, crearVerticalAccion } from "./acciones";

export const metadata: Metadata = { title: "Ajustes · Verse App" };

const ESTADOS = { activo: "Activo", invitado: "Invitado", suspendido: "Suspendido" } as const;

async function Panel() {
  const sesion = await sesionActual();
  if (!sesion.maestro) return <p>Ajustes es solo para el Maestro.</p>;
  const usuarios = await listarUsuarios(db(), sesion);
  const lista = await db().select().from(plantillas);
  const estructura = sesion.estructura ?? [];

  return (
    <>
      <Seccion titulo={`Usuarios · ${usuarios.length}`}>
        <ul className="divide-y divide-border">
          {usuarios.map((u) => (
            <li key={u.id} className="py-2.5">
              <Link href={`/ajustes/usuarios/${u.id}`} className="flex items-baseline justify-between gap-3">
                <span>
                  <b className="text-foreground">{u.nombre}</b>
                  {u.maestro ? " · Maestro" : ""}
                  <span className="block text-[12.5px] text-muted-foreground">{u.correo}</span>
                </span>
                <span className="shrink-0 text-[12.5px] text-muted-foreground">
                  {ESTADOS[u.estado]}
                  {u.accesos.length ? ` · ${u.accesos.map((a) => estructura.find((e) => e.id === a.empresaId)?.nombre ?? a.empresaId).join(", ")}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Nuevo usuario">
        <Forma action={crearUsuarioAccion} boton="Crear usuario">
          <Campo etiqueta="Nombre">
            <input name="nombre" required className={estiloEntrada} />
          </Campo>
          <Campo etiqueta="Correo de Google">
            <input name="correo" type="email" required className={estiloEntrada} />
          </Campo>
          <Campo etiqueta="Celular">
            <input name="celular" inputMode="tel" className={estiloEntrada} />
          </Campo>
          <Campo etiqueta="Nombre en Airtable (Responsable o funcionaria)">
            <input name="nombreAirtable" className={estiloEntrada} />
          </Campo>
        </Forma>
      </Seccion>

      <Seccion titulo="Empresas y verticales">
        {estructura.map((e) => (
          <div key={e.id}>
            <b className="text-foreground">{e.nombre}</b>
            <span className="text-muted-foreground"> · {e.verticales.map((v) => `${v.nombre} (${v.modulos.length})`).join(", ")}</span>
          </div>
        ))}
        <Forma action={crearEmpresaAccion} boton="Crear empresa" className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Nueva empresa">
            <input name="nombre" required className={estiloEntrada} />
          </Campo>
        </Forma>
        <Forma action={crearVerticalAccion} boton="Crear vertical" className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Empresa">
            <select name="empresa" className={estiloEntrada}>
              {estructura.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Nueva vertical">
            <input name="nombre" required className={estiloEntrada} />
          </Campo>
        </Forma>
      </Seccion>

      <Seccion titulo="Plantillas">
        <p className="text-muted-foreground">{lista.map((p) => p.nombre).join(" · ")}</p>
      </Seccion>
    </>
  );
}

export default function Ajustes() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <Encabezado submarca="AJUSTES" />
      <Tarjeta>
        <Suspense fallback={<p className="text-muted-foreground">Cargando</p>}>
          <Panel />
        </Suspense>
      </Tarjeta>
    </main>
  );
}
