import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Campo, estiloEntrada, Forma } from "@/components/ajustes/forma";
import { Seccion } from "@/components/ajustes/encabezado";
import { EncabezadoModulo, EsqueletoModulo } from "@/components/modulos/encabezado";
import { Badge } from "@/components/ui/badge";
import { Invitar } from "@/components/ajustes/invitar";
import { Button } from "@/components/ui/button";
import { eq } from "drizzle-orm";
import { db } from "@/db/cliente";
import { plantillas, usuarios } from "@/db/esquema";
import { sesionActual } from "@/lib/acceso/actual";
import type { Casillas } from "@/lib/acceso/casillas";
import type { EmpresaBase } from "@/lib/acceso/estructura";
import { sesionPorId } from "@/lib/acceso/sesion";
import { casillasAccion, editarUsuarioAccion, estadoAccion, invitarAccion, plantillaAccion, quitarAccesoAccion } from "../../acciones";

export const metadata: Metadata = { title: "Usuario · Ajustes" };

const NIVELES = [
  ["sin", "Sin acceso"],
  ["ver", "Ver"],
  ["editar", "Editar"],
] as const;
const CORREO = [
  ["sin", "Sin acceso"],
  ["leer", "Leer"],
  ["redactar", "Redactar"],
  ["enviar", "Enviar"],
] as const;
const CODIGOS = [
  ["nunca", "Nunca"],
  ["turno", "Solo en su turno"],
  ["siempre", "Siempre"],
] as const;

function Opciones({ nombre, valor, opciones }: { nombre: string; valor: string; opciones: readonly (readonly [string, string])[] }) {
  return (
    <select name={nombre} defaultValue={valor} className={`${estiloEntrada} w-auto`}>
      {opciones.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
}

function EditorCasillas({ empresa, casillas }: { empresa: EmpresaBase; casillas: Casillas | undefined }) {
  const c = casillas;
  return (
    <div className="space-y-4">
      {empresa.verticales.map((v) => (
        <fieldset key={v.id} className="space-y-2">
          <legend className="text-xs font-medium text-muted-foreground">{v.nombre}</legend>
          {v.modulos.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <span>{m.nombre}</span>
              <Opciones nombre={`m:${m.id}`} valor={c?.modulos[m.id] ?? "sin"} opciones={NIVELES} />
            </div>
          ))}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <label>
              <input type="checkbox" name={`cif:${v.id}`} defaultChecked={Boolean(c?.cifras[v.id])} /> Cifras de dinero
            </label>
            <label>
              <input type="checkbox" name={`ter:${v.id}`} defaultChecked={Boolean(c?.terceros[v.id])} /> Datos de terceros
            </label>
            <label className="flex items-center gap-2">
              Códigos <Opciones nombre={`cod:${v.id}`} valor={c?.codigos[v.id] ?? "nunca"} opciones={CODIGOS} />
            </label>
          </div>
        </fieldset>
      ))}
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">Empresa</legend>
        <div className="flex items-center justify-between gap-3">
          <span>Alcance en Hoy</span>
          <Opciones
            nombre="alcance"
            valor={c?.alcanceHoy ?? "suyo"}
            opciones={[
              ["suyo", "Lo suyo"],
              ["todo", "Todo"],
            ]}
          />
        </div>
        {empresa.cuentas.map((cu) => (
          <div key={cu.id} className="flex items-center justify-between gap-3">
            <span>Correo {cu.nombre}</span>
            <Opciones nombre={`c:${cu.id}`} valor={c?.correo[cu.id] ?? "sin"} opciones={CORREO} />
          </div>
        ))}
        <div className="flex items-center justify-between gap-3">
          <span>Asistente</span>
          <Opciones
            nombre="asistente"
            valor={c?.asistente ?? "no"}
            opciones={[
              ["no", "No"],
              ["consultas", "Consultas"],
              ["acciones", "Consultas y acciones"],
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 text-[13px]">
          <label>
            <input type="checkbox" name="aprobar" defaultChecked={Boolean(c?.aprobar)} /> Aprobar
          </label>
          <label>
            <input type="checkbox" name="descargar" defaultChecked={Boolean(c?.descargar)} /> Descargar
          </label>
        </div>
      </fieldset>
    </div>
  );
}

async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await sesionActual();
  if (!sesion.maestro) return <EncabezadoModulo titulo="Ajustes" descripcion="Ajustes es solo para el Maestro." />;
  const { id } = await params;
  const usuario = await sesionPorId(db(), id);
  if (!usuario) notFound();
  const [datos] = await db().select().from(usuarios).where(eq(usuarios.id, id));
  const lista = await db().select().from(plantillas);
  const estructura = sesion.estructura ?? [];
  const esYo = id === sesion.usuarioId;

  return (
    <>
      <EncabezadoModulo titulo={datos!.nombre} descripcion={datos!.correo}>
        <span className="flex items-center gap-2">
          <Badge variant={datos!.estado === "activo" ? "secondary" : datos!.estado === "suspendido" ? "destructive" : "outline"}>
            {datos!.estado === "activo" ? "Activo" : datos!.estado === "invitado" ? "Invitado" : "Suspendido"}
          </Badge>
          {datos!.maestro && <Badge variant="outline">Maestro</Badge>}
        </span>
      </EncabezadoModulo>
      <div className="space-y-4 px-4 pb-10 md:px-6">
      <Link href="/ajustes" className="text-sm text-muted-foreground hover:text-foreground">
        ← Usuarios
      </Link>
      <Seccion titulo="Datos">
        <Forma action={editarUsuarioAccion.bind(null, id)} boton="Guardar datos">
          <Campo etiqueta="Nombre">
            <input name="nombre" defaultValue={datos!.nombre} required className={estiloEntrada} />
          </Campo>
          <Campo etiqueta="Correo de Google">
            <input name="correo" type="email" defaultValue={datos!.correo} required className={estiloEntrada} />
          </Campo>
          <Campo etiqueta="Celular">
            <input name="celular" defaultValue={datos!.celular ?? ""} className={estiloEntrada} />
          </Campo>
          <Campo etiqueta="Nombre en Airtable">
            <input name="nombreAirtable" defaultValue={datos!.nombreAirtable ?? ""} className={estiloEntrada} />
          </Campo>
        </Forma>
      </Seccion>

      {!esYo && (
        <Seccion titulo="Acceso">
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/hoy?verComo=${id}`} className="underline underline-offset-2 hover:text-foreground">
              Ver como {datos!.nombre}
            </Link>
            <form action={estadoAccion.bind(null, id, datos!.estado === "suspendido" ? "activo" : "suspendido")}>
              <Button type="submit" variant="outline">
                {datos!.estado === "suspendido" ? "Reactivar" : "Suspender"}
              </Button>
            </form>
          </div>
          {datos!.estado === "invitado" && <Invitar action={invitarAccion.bind(null, id)} />}
        </Seccion>
      )}

      {datos!.maestro ? (
        <p className="text-muted-foreground">El Maestro ve y edita todo; no necesita casillas.</p>
      ) : (
        estructura.map((empresa) => {
          const casillas = usuario.accesos[empresa.id];
          const deEmpresa = lista.filter((p) => p.empresaId === empresa.id);
          return (
            <Seccion key={empresa.id} titulo={empresa.nombre} descripcion={casillas ? "Con acceso" : "Sin acceso"}>
              {deEmpresa.length > 0 && (
                <Forma action={plantillaAccion.bind(null, id, empresa.id)} boton="Aplicar plantilla" className="flex flex-wrap items-end gap-3">
                  <Campo etiqueta="Plantilla">
                    <select name="plantilla" className={estiloEntrada} defaultValue="">
                      <option value="" disabled>
                        Elegir
                      </option>
                      {deEmpresa.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </Forma>
              )}
              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer text-sm text-muted-foreground">Ajuste fino por casilla</summary>
                <div className="pt-3">
                  <Forma action={casillasAccion.bind(null, id, empresa.id)} boton="Guardar casillas">
                    <EditorCasillas empresa={empresa} casillas={casillas} />
                  </Forma>
                </div>
              </details>
              {casillas && (
                <form action={quitarAccesoAccion.bind(null, id, empresa.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    Quitar acceso a {empresa.nombre}
                  </Button>
                </form>
              )}
            </Seccion>
          );
        })
      )}
      </div>
    </>
  );
}

export default function Usuario({ params }: PageProps<"/ajustes/usuarios/[id]">) {
  return (
    <Suspense fallback={<EsqueletoModulo />}>
      <Ficha params={params} />
    </Suspense>
  );
}
