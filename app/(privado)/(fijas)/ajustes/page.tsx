import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Dialogo } from "@/components/ajustes/dialogo";
import { Campo, estiloEntrada, Forma } from "@/components/ajustes/forma";
import { EncabezadoModulo, EsqueletoModulo } from "@/components/modulos/encabezado";
import { LogoEmpresa } from "@/components/shell/logo-empresa";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db/cliente";
import { plantillas } from "@/db/esquema";
import { sesionActual } from "@/lib/acceso/actual";
import { listarUsuarios } from "@/lib/acceso/admin";
import { PLATFORM_NAME } from "@/lib/config";
import { estadoModulos } from "@/lib/modulos/registro";
import { ModuloSistema } from "@/components/modulos/sistema/modulo-sistema";
import { ConectarAuco } from "@/components/ajustes/conectar-auco";
import { aucoConfigurado } from "@/lib/firma/auco";
import { cn } from "@/lib/utils";
import { estadoConexiones, type Conexion } from "@/lib/correo/conexiones";
import { composioServidor } from "@/lib/servidor/composio";
import { conectarCuentaAccion, crearEmpresaAccion, crearUsuarioAccion, crearVerticalAccion, editarEmpresaAccion } from "./acciones";

export const metadata: Metadata = { title: `Ajustes · ${PLATFORM_NAME}` };

const ESTADOS = { activo: "Activo", invitado: "Invitado", suspendido: "Suspendido" } as const;
const VISTAS = [
  ["usuarios", "Usuarios"],
  ["empresas", "Empresas y módulos"],
  ["plantillas", "Plantillas"],
  ["conexiones", "Conexiones"],
  ["sistema", "Sistema"],
] as const;
type Vista = (typeof VISTAS)[number][0];
type Estructura = NonNullable<Awaited<ReturnType<typeof sesionActual>>["estructura"]>;

async function Panel({ searchParams }: { searchParams: Promise<{ vista?: string; error?: string; empresa?: string }> }) {
  const sesion = await sesionActual();
  if (!sesion.maestro) return <EncabezadoModulo titulo="Ajustes" descripcion="Ajustes es solo para el Maestro." />;
  const { vista: pedida, error, empresa: empresaPedida } = await searchParams;
  const vista: Vista = VISTAS.some(([v]) => v === pedida) ? (pedida as Vista) : "usuarios";
  const estructura = sesion.estructura ?? [];

  return (
    <>
      <EncabezadoModulo titulo="Ajustes" descripcion="Usuarios, accesos, empresas y módulos de la plataforma">
        {vista === "usuarios" && (
          <Dialogo boton="Nuevo usuario" titulo="Nuevo usuario" descripcion="Después le das acceso con una plantilla y generas su enlace de invitación.">
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
              <Campo etiqueta="Nombre en Airtable" ayuda="Responsable en TRAZABILIDAD o funcionaria en LIMPIEZA">
                <input name="nombreAirtable" className={estiloEntrada} />
              </Campo>
            </Forma>
          </Dialogo>
        )}
      </EncabezadoModulo>
      <nav aria-label="Secciones de Ajustes" className="flex gap-1 border-b px-4 md:px-6">
        {VISTAS.map(([v, t]) => (
          <Link
            key={v}
            href={`/ajustes?vista=${v}`}
            aria-current={v === vista ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", v === vista ? "border-acento font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-6 md:px-6">
        {vista === "usuarios" && <Usuarios sesion={sesion} estructura={estructura} />}
        {vista === "empresas" && <Empresas estructura={estructura} />}
        {vista === "plantillas" && <Plantillas estructura={estructura} />}
        {vista === "conexiones" && <Conexiones error={error} />}
        {vista === "sistema" && <SistemaAjustes sesion={sesion} estructura={estructura} empresa={empresaPedida} />}
      </div>
    </>
  );
}

async function Usuarios({ sesion, estructura }: { sesion: Awaited<ReturnType<typeof sesionActual>>; estructura: Estructura }) {
  const usuarios = await listarUsuarios(db(), sesion);
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Nombre</TableHead>
            <TableHead className="max-md:hidden">Correo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="pr-4 max-md:hidden">Empresas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => (
            <TableRow key={u.id} className="relative">
              <TableCell className="pl-4">
                <Link href={`/ajustes/usuarios/${u.id}`} className="font-medium after:absolute after:inset-0">
                  {u.nombre}
                </Link>
                {u.maestro && <span className="ml-2 text-xs text-muted-foreground">Maestro</span>}
              </TableCell>
              <TableCell className="text-muted-foreground max-md:hidden">{u.correo}</TableCell>
              <TableCell>
                <Badge variant={u.estado === "activo" ? "secondary" : u.estado === "suspendido" ? "destructive" : "outline"}>{ESTADOS[u.estado]}</Badge>
              </TableCell>
              <TableCell className="pr-4 text-muted-foreground max-md:hidden">
                {u.maestro ? "Todas" : u.accesos.map((a) => estructura.find((e) => e.id === a.empresaId)?.nombre ?? a.empresaId).join(", ") || "Sin acceso"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Empresas({ estructura }: { estructura: Estructura }) {
  const estados = estadoModulos(estructura);
  return (
    <div className="space-y-6">
      {estructura.map((e) => {
        const est = estados.find((x) => x.empresa === e.id)!;
        return (
          <section key={e.id} className="rounded-lg border">
            <header className="flex items-center gap-3 border-b px-4 py-3">
              <LogoEmpresa nombre={e.nombre} logo={e.logo ?? null} acento={e.acento ?? "#18181b"} className="size-8" />
              <h2 className="font-medium">{e.nombre}</h2>
              <span className="text-xs text-muted-foreground">{e.id}</span>
            </header>
            <div className="grid gap-6 p-4 lg:grid-cols-[320px_1fr]">
              <Forma action={editarEmpresaAccion.bind(null, e.id)} boton="Guardar">
                <Campo etiqueta="Nombre">
                  <input name="nombre" defaultValue={e.nombre} required className={estiloEntrada} />
                </Campo>
                <Campo etiqueta="Color de acento" ayuda="Solo en el selector, el ítem activo y los botones primarios">
                  <span className="flex gap-2">
                    <input type="color" aria-label="Elegir color" defaultValue={e.acento ?? "#18181b"} className="h-9 w-12 rounded-md border bg-transparent p-1" name="acento" />
                  </span>
                </Campo>
                <Campo etiqueta="Logo" ayuda="Enlace https a una imagen cuadrada; vacío usa la inicial">
                  <input name="logo" type="url" defaultValue={e.logo ?? ""} placeholder="https://" className={estiloEntrada} />
                </Campo>
              </Forma>
              <div className="space-y-4">
                {est.verticales.map((v) => (
                  <div key={v.id}>
                    <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{v.nombre}</h3>
                    <ul className="divide-y rounded-md border text-sm">
                      {v.modulos.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <span className="min-w-0">
                            <span className="block truncate">{m.nombre}</span>
                            {m.fuentes.length > 0 && <span className="block truncate text-xs text-muted-foreground">{m.fuentes.join(", ")}</span>}
                          </span>
                          <Badge variant={m.disponible ? "secondary" : "outline"}>{m.disponible ? "Disponible" : "No disponible"}</Badge>
                        </li>
                      ))}
                      {v.modulos.length === 0 && <li className="px-3 py-2 text-muted-foreground">Sin módulos todavía.</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Nueva empresa</h2>
          <Forma action={crearEmpresaAccion} boton="Crear empresa">
            <Campo etiqueta="Nombre" ayuda="Nace con la vertical General; los módulos se agregan después">
              <input name="nombre" required className={estiloEntrada} />
            </Campo>
          </Forma>
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Nueva vertical</h2>
          <Forma action={crearVerticalAccion} boton="Crear vertical">
            <Campo etiqueta="Empresa">
              <select name="empresa" className={estiloEntrada}>
                {estructura.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Nombre">
              <input name="nombre" required className={estiloEntrada} />
            </Campo>
          </Forma>
        </section>
      </div>
    </div>
  );
}

async function Plantillas({ estructura }: { estructura: Estructura }) {
  const lista = await db().select().from(plantillas);
  const nombreModulo = (id: string) => estructura.flatMap((e) => e.verticales.flatMap((v) => v.modulos)).find((m) => m.id === id)?.nombre ?? id;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {lista.map((p) => {
        const c = p.casillas;
        const modulos = Object.entries(c.modulos).filter(([, n]) => n !== "sin");
        return (
          <section key={p.id} className="space-y-2 rounded-lg border p-4 text-sm">
            <header className="flex items-center justify-between">
              <h2 className="font-medium">{p.nombre}</h2>
              <Badge variant="outline">{estructura.find((e) => e.id === p.empresaId)?.nombre ?? p.empresaId}</Badge>
            </header>
            <p className="text-muted-foreground">
              Hoy: {c.alcanceHoy === "todo" ? "todo" : "lo suyo"} · Aprobar: {c.aprobar ? "sí" : "no"} · Asistente: {c.asistente === "no" ? "no" : c.asistente}
            </p>
            <p>{modulos.length ? modulos.map(([m, n]) => `${nombreModulo(m)} (${n})`).join(", ") : "Sin módulos"}</p>
          </section>
        );
      })}
    </div>
  );
}

export default function Ajustes({ searchParams }: PageProps<"/ajustes">) {
  return (
    <Suspense fallback={<EsqueletoModulo />}>
      <Panel searchParams={searchParams as Promise<{ vista?: string }>} />
    </Suspense>
  );
}

const ESTADO_CONEXION = { activa: "Conectada", inactiva: "Vencida", falta: "Sin conectar" } as const;

/** Cuentas de Gmail y Drive de la app en su proyecto de Composio, con su botón para conectar. */
async function Conexiones({ error }: { error?: string }) {
  const cliente = composioServidor();
  let lista: Conexion[] | null = null;
  let falla: string | undefined;
  if (cliente) {
    try {
      lista = await estadoConexiones(cliente);
    } catch (e) {
      falla = e instanceof Error ? e.message.slice(0, 160) : "Composio no respondió";
    }
  } else falla = "Falta COMPOSIO_API_KEY en Vercel.";
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        La app usa su propio proyecto de Composio, separado del de Claude. Conecta cada cuenta una vez: el botón abre Google y vuelves aquí. La cuenta personal no entra.
      </p>
      <ConectarAuco configurado={aucoConfigurado()} />
      {(error || falla) && (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {error ?? falla}
        </p>
      )}
      {lista && (
        <ul className="divide-y rounded-lg border">
          {lista.map((c) => (
            <li key={c.alias} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {c.toolkit === "gmail" ? "Gmail" : "Drive"} · {c.alias}
                </p>
              </div>
              {c.estado === "activa" ? (
                <Badge variant="secondary">{ESTADO_CONEXION.activa}</Badge>
              ) : (
                <form action={conectarCuentaAccion} className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{ESTADO_CONEXION[c.estado]}</span>
                  <input type="hidden" name="alias" value={c.alias} />
                  <button type="submit" className="h-8 rounded-md bg-acento px-3 text-sm text-acento-foreground hover:bg-acento/90">
                    Conectar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sistema (antes en el menú): salud, sincronización, respaldos y corridas, por empresa. */
function SistemaAjustes({ sesion, estructura, empresa }: { sesion: Awaited<ReturnType<typeof sesionActual>>; estructura: Estructura; empresa?: string }) {
  const empresas = estructura.map((e) => ({ id: e.id, nombre: e.nombre }));
  const activa = empresas.some((e) => e.id === empresa) ? empresa! : (empresas[0]?.id ?? "verse");
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Empresa" className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {empresas.map((e) => (
          <Link
            key={e.id}
            href={`/ajustes?vista=sistema&empresa=${e.id}`}
            role="tab"
            aria-selected={e.id === activa}
            className={cn("rounded-md px-3 py-1 text-sm", e.id === activa ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
          >
            {e.nombre}
          </Link>
        ))}
      </div>
      <ModuloSistema sesion={sesion} empresa={activa} enAjustes />
    </div>
  );
}
