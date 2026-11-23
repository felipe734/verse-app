"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { abrirEdicion, guardarEdicionAccion, type RefModulo } from "@/app/modulos/editar";
import { Button } from "@/components/ui/button";
import type { Formulario } from "@/lib/modulos/editar";

const caja = "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Edición de una fila en el detalle: estados y comentarios, con lo que se vio al abrir. */
export function Edicion({ refModulo, recId, alGuardar }: { refModulo: RefModulo; recId: string; alGuardar: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<Formulario | null>(null);
  const [valores, setValores] = useState<Record<string, string | boolean>>({});
  const [ocupado, setOcupado] = useState(false);

  async function abrir() {
    setOcupado(true);
    const r = await abrirEdicion(refModulo, recId);
    setOcupado(false);
    if ("error" in r) return void toast.error(r.error);
    setForm(r);
    setValores(Object.fromEntries(r.campos.map((c) => [c.campo, c.valor])));
  }

  async function guardar() {
    if (!form) return;
    const cambios = Object.fromEntries(form.campos.filter((c) => valores[c.campo] !== c.valor).map((c) => [c.campo, valores[c.campo]!]));
    if (!Object.keys(cambios).length) return setForm(null);
    setOcupado(true);
    const r = await guardarEdicionAccion(refModulo, recId, cambios, form.antes);
    setOcupado(false);
    if (r.ok) {
      toast.success(r.mensaje);
      setForm(null);
      alGuardar();
      router.refresh();
    } else toast.error(r.mensaje);
  }

  if (!form)
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={abrir} disabled={ocupado}>
        {ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Pencil className="size-4" aria-hidden />} Editar
      </Button>
    );

  return (
    <form
      className="space-y-3"
      aria-label="Editar fila"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      {form.campos.map((c) => (
        <label key={c.campo} className={c.tipo === "casilla" ? "flex items-center gap-2 text-sm" : "block space-y-1.5 text-sm"}>
          {c.tipo === "casilla" ? (
            <>
              <input type="checkbox" className="size-4" checked={Boolean(valores[c.campo])} onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.checked }))} />
              {c.etiqueta}
            </>
          ) : (
            <>
              <span className="font-medium">{c.etiqueta}</span>
              {c.tipo === "opciones" ? (
                <select className={caja} value={String(valores[c.campo] ?? "")} onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.value }))}>
                  <option value="">Sin valor</option>
                  {c.opciones?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea className={caja} rows={3} value={String(valores[c.campo] ?? "")} onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.value }))} />
              )}
            </>
          )}
        </label>
      ))}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={ocupado}>
          {ocupado && <Loader2 className="size-4 animate-spin" aria-hidden />} Guardar
        </Button>
      </div>
    </form>
  );
}
