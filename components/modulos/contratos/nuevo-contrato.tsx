"use client";

import { FileSignature, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { borradorAccion, generarContratoAccion, opcionesContratoAccion } from "@/app/modulos/contratos";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fin, MODELOS, TIPOS_DOC, type DatosContrato, type TipoDoc } from "@/lib/contratos/tipos";

const caja = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
type Opcion = { recId: string; nombre: string };

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{etiqueta}</span>
      {children}
    </label>
  );
}

/**
 * Contrato nuevo: unidad + residente, datos que trae Airtable para revisar y completar, y
 * "Generar". La app llena el modelo aprobado; Haiku solo lee la cédula para compararla.
 */
export function NuevoContrato({ maestro }: { maestro: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState<{ unidades: Opcion[]; personas: Opcion[] } | null>(null);
  const [unidad, setUnidad] = useState("");
  const [persona, setPersona] = useState("");
  const [d, setD] = useState<DatosContrato | null>(null);
  const [fotos, setFotos] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [validacion, setValidacion] = useState<string[] | null>(null);
  const [sinValidar, setSinValidar] = useState(false);

  function abrir() {
    setAbierto(true);
    setD(null);
    setValidacion(null);
    setUnidad("");
    setPersona("");
    void opcionesContratoAccion().then((r) => {
      if ("error" in r) {
        toast.error(r.error);
        return setAbierto(false);
      }
      setOpciones(r);
    });
  }

  async function cargar(u: string, p: string) {
    setD(null);
    setValidacion(null);
    if (!u || !p) return;
    setOcupado(true);
    const r = await borradorAccion(u, p);
    setOcupado(false);
    if ("error" in r) return void toast.error(r.error);
    setFotos(r.fotos);
    setD({ inicio: "", parqueadero: "", lugarExpedicion: "", ...r.datos } as DatosContrato);
  }

  async function generar() {
    if (!d) return;
    setOcupado(true);
    const r = await generarContratoAccion(unidad, persona, d, sinValidar);
    setOcupado(false);
    setValidacion(r.validacion ?? null);
    if (!r.ok) return void toast.error(r.mensaje);
    toast.success(r.mensaje);
    setAbierto(false);
    router.refresh();
  }

  const poner = <K extends keyof DatosContrato>(k: K, v: DatosContrato[K]) => d && setD({ ...d, [k]: v });
  const vivienda = d && d.modelo !== "vl-coliving";

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={abrir}>
        <FileSignature className="size-4" aria-hidden /> Nuevo contrato
      </Button>
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>Nuevo contrato</SheetTitle>
            <SheetDescription>Modelo aprobado con los datos de Airtable. Queda en CONTRATO como Elaborado.</SheetDescription>
          </SheetHeader>
          <form
            aria-label="Nuevo contrato"
            className="flex-1 space-y-3 overflow-y-auto p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void generar();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Unidad">
                <select
                  className={caja}
                  value={unidad}
                  disabled={!opciones}
                  onChange={(e) => {
                    setUnidad(e.target.value);
                    void cargar(e.target.value, persona);
                  }}
                >
                  <option value="">{opciones ? "Elige" : "Cargando…"}</option>
                  {opciones?.unidades.map((u) => (
                    <option key={u.recId} value={u.recId}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Residente (DATOS)">
                <select
                  className={caja}
                  value={persona}
                  disabled={!opciones}
                  onChange={(e) => {
                    setPersona(e.target.value);
                    void cargar(unidad, e.target.value);
                  }}
                >
                  <option value="">{opciones ? "Elige" : "Cargando…"}</option>
                  {opciones?.personas.map((p) => (
                    <option key={p.recId} value={p.recId}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            {opciones && !opciones.unidades.length && <p className="text-xs text-muted-foreground">No hay unidades sin contrato en UNIDADES de Living.</p>}

            {ocupado && !d && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Leyendo Airtable
              </p>
            )}

            {d && (
              <>
                <p className="rounded-lg bg-muted px-3 py-2 text-xs">
                  Modelo: <span className="font-medium">{MODELOS[d.modelo].nombre}</span> · {fotos ? `${fotos} foto(s) del documento en DATOS` : "DATOS no tiene fotos del documento"}
                </p>
                <Campo etiqueta="Nombre completo">
                  <input className={caja} required value={d.nombre} onChange={(e) => poner("nombre", e.target.value)} />
                </Campo>
                <div className="grid grid-cols-3 gap-3">
                  <Campo etiqueta="Documento">
                    <select className={caja} value={d.tipoDoc} onChange={(e) => poner("tipoDoc", e.target.value as TipoDoc)}>
                      {Object.entries(TIPOS_DOC).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo etiqueta="Número">
                    <input className={caja} required value={d.numeroDoc} onChange={(e) => poner("numeroDoc", e.target.value)} />
                  </Campo>
                  {vivienda && (
                    <Campo etiqueta="Expedido en">
                      <input className={caja} required value={d.lugarExpedicion ?? ""} onChange={(e) => poner("lugarExpedicion", e.target.value)} placeholder="Bogotá D.C." />
                    </Campo>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Correo">
                    <input className={caja} required type="email" value={d.correo} onChange={(e) => poner("correo", e.target.value)} />
                  </Campo>
                  <Campo etiqueta="WhatsApp">
                    <input className={caja} required value={d.whatsapp} onChange={(e) => poner("whatsapp", e.target.value)} />
                  </Campo>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Campo etiqueta="Inicio">
                    <input className={caja} required type="date" value={d.inicio} onChange={(e) => poner("inicio", e.target.value)} />
                  </Campo>
                  <Campo etiqueta="Meses">
                    <input className={caja} required type="number" min={1} max={60} value={d.meses || ""} onChange={(e) => poner("meses", Number(e.target.value))} />
                  </Campo>
                  <Campo etiqueta="Termina">
                    <input className={caja} disabled value={d.inicio && d.meses > 0 ? fin(d) : ""} />
                  </Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta={vivienda ? "Canon" : "Canon todo incluido"}>
                    <input className={caja} required type="number" min={1} value={d.canon || ""} onChange={(e) => poner("canon", Number(e.target.value))} />
                  </Campo>
                  {vivienda ? (
                    <Campo etiqueta="Administración">
                      <input className={caja} required type="number" min={1} value={d.admin || ""} onChange={(e) => poner("admin", Number(e.target.value))} />
                    </Campo>
                  ) : (
                    <Campo etiqueta="Preaviso (días)">
                      <input className={caja} type="number" min={1} value={d.diasPreaviso ?? 30} onChange={(e) => poner("diasPreaviso", Number(e.target.value))} />
                    </Campo>
                  )}
                </div>
                {vivienda && (
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="Referencia de pago">
                      <input className={caja} required value={d.referenciaPago ?? ""} onChange={(e) => poner("referenciaPago", e.target.value)} />
                    </Campo>
                    <Campo etiqueta="Parqueadero">
                      <input className={caja} value={d.parqueadero ?? ""} onChange={(e) => poner("parqueadero", e.target.value)} placeholder={d.modelo === "vl-vivienda-balcony" ? "Vacío: sin fila" : "No aplica"} />
                    </Campo>
                  </div>
                )}
                {d.modelo === "vl-vivienda-balcony" && (
                  <div className="grid grid-cols-3 gap-3">
                    <Campo etiqueta="Matrícula">
                      <input className={caja} required value={d.matricula ?? ""} onChange={(e) => poner("matricula", e.target.value)} />
                    </Campo>
                    <Campo etiqueta="Contador ENEL">
                      <input className={caja} required value={d.contadorEnel ?? ""} onChange={(e) => poner("contadorEnel", e.target.value)} />
                    </Campo>
                    <Campo etiqueta="Contrato EAAB">
                      <input className={caja} required value={d.contratoEaab ?? ""} onChange={(e) => poner("contratoEaab", e.target.value)} />
                    </Campo>
                  </div>
                )}

                {validacion && (
                  <div className="rounded-lg border px-3 py-2 text-xs">
                    <p className="mb-1 font-medium">Revisión del documento</p>
                    {validacion.map((l) => (
                      <p key={l} className={l.includes("NO coincide") || l.startsWith("No se pudo") ? "text-destructive" : "text-muted-foreground"}>
                        {l}
                      </p>
                    ))}
                  </div>
                )}
                {maestro && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={sinValidar} onChange={(e) => setSinValidar(e.target.checked)} /> Generar aunque el documento no cuadre (queda anotado)
                  </label>
                )}
                <Button type="submit" className="w-full gap-1.5" disabled={ocupado}>
                  {ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileSignature className="size-4" aria-hidden />}
                  {ocupado ? "Revisando documento y armando el PDF" : "Generar contrato"}
                </Button>
              </>
            )}
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
