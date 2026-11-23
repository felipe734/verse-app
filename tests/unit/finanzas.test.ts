import { describe, expect, it } from "vitest";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { aNumero, leerCierre, PESTANAS, pestanaDe } from "@/lib/modulos/finanzas";
import { navegacion } from "@/lib/modulos/registro";
import { leerTabla } from "@/lib/modulos/tabla";
import { ids } from "@/lib/modulos/tablas-equipo";
import { AirtableFalso } from "../apoyo/airtable-falso";

const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "00000000-0000-0000-0000-000000000006",
  correo: "p@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Prueba",
  accesos,
  estructura: ESTRUCTURA,
  ...extra,
});
const maestro = sesion({}, { maestro: true });
const HOY = "2026-11-25";

describe("Finanzas", () => {
  it("aparece en General de Verse y de C&C para el Maestro", () => {
    const rutas = [...navegacion(maestro, ESTRUCTURA, "verse").flatMap((g) => g.items), ...navegacion(maestro, ESTRUCTURA, "cyc").flatMap((g) => g.items)].map((i) => i.href);
    expect(rutas).toEqual(expect.arrayContaining(["/verse/general/finanzas", "/cyc/general/finanzas"]));
  });

  it("la pestaña por defecto es la primera y una desconocida no rompe", () => {
    expect(pestanaDe("finanzas")?.id).toBe("movimientos");
    expect(pestanaDe("finanzas", "cruces")?.id).toBe("cruces");
    expect(pestanaDe("finanzas-cyc", "nada")?.id).toBe("bancos");
  });

  it("sin la casilla de cifras no se piden montos ni el cierre", async () => {
    const at = new AirtableFalso();
    const admin = plantilla("administrador-verse").casillas;
    const sinCifras = sesion({ verse: { ...admin, cifras: { ...admin.cifras, "verse-general": false } } });
    const mov = pestanaDe("finanzas", "movimientos")!.tabla;
    const r = await leerTabla(at, sinCifras, "verse", "verse-general", mov, HOY);
    expect(at.consultas[0]!.campos).not.toEqual(expect.arrayContaining(["Débito"]));
    expect(r.ocultos).toContain("montos");
    expect(await leerCierre(at, sinCifras)).toBeNull();
  });

  it("el cierre lee AGREGADO ordenado y convierte los montos", async () => {
    const at = new AirtableFalso();
    const { idBase, idTabla } = ids("2. FACTURACION", "AGREGADO");
    at.poner(idBase, idTabla, { Fecha: "1/9/2026", "TOTAL INGRESOS": "$30.000.000", "CONTRIBUCIÓN TOTAL": "$9.000.000", "OVERHEAD COSTO": "$5.000.000", "MARGEN NETO": "$4.000.000" });
    at.poner(idBase, idTabla, { Fecha: "1/10/2026", "TOTAL INGRESOS": "$33.500.000", "CONTRIBUCIÓN TOTAL": "$10.000.000", "OVERHEAD COSTO": "$5.200.000", "MARGEN NETO": "-$200.000" });
    const meses = await leerCierre(at, maestro);
    expect(meses?.map((m) => m.mes)).toEqual(["2026-10", "2026-09"]);
    expect(meses?.[0]).toMatchObject({ ingresos: 33_500_000, margen: -200_000 });
    expect(at.consultas[0]!.orden).toEqual({ campo: "Fecha", desc: true });
  });

  it("ninguna pestaña pide números de cuenta, cédulas ni credenciales", () => {
    const prohibidos = /# ?CUENTA|Num Cuenta|Cedula|Cédula|Cert Bancaria|Contraseña|RNT|FONTUR/i;
    for (const [tipo, lista] of Object.entries(PESTANAS))
      for (const p of lista)
        for (const c of [{ campo: p.tabla.titulo }, ...p.tabla.columnas, ...(p.tabla.detalle ?? [])]) expect(prohibidos.test(c.campo), `${tipo}/${p.id}: ${c.campo}`).toBe(false);
  });

  it("todo monto está marcado como cifras y los documentos como terceros", () => {
    for (const lista of Object.values(PESTANAS))
      for (const p of lista)
        for (const c of [...p.tabla.columnas, ...(p.tabla.detalle ?? [])]) {
          if (c.tipo === "dinero") expect(c.sensible).toBe("cifras");
          if (/^(DOC|NIT \/ CC)$/.test(c.campo)) expect(c.sensible).toBe("terceros");
        }
  });

  it("convierte montos en formato colombiano", () => {
    expect(aNumero("$1.250.000")).toBe(1_250_000);
    expect(aNumero("-$3.400")).toBe(-3400);
    expect(aNumero("")).toBeNull();
    expect(aNumero(undefined)).toBeNull();
  });
});
