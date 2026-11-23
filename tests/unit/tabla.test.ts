import { describe, expect, it } from "vitest";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { columnasPermitidas, leerTabla } from "@/lib/modulos/tabla";
import { TABLAS_EQUIPO } from "@/lib/modulos/tablas-equipo";
import { leerPeriodo } from "@/lib/vistas/periodo";
import { AirtableFalso } from "../apoyo/airtable-falso";

const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "00000000-0000-0000-0000-000000000005",
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

describe("módulos de tabla", () => {
  it("coordinación de aseo ve reservas sin montos ni huésped, pero con códigos", async () => {
    const at = new AirtableFalso();
    const def = TABLAS_EQUIPO.operacion!;
    at.poner(def.idBase, def.idTabla, { Unidad: "Torre 603", Ingreso: "26/11/2026", Total_H: "$900.000", Nombre: "Huésped", Código: "1234" });
    const r = await leerTabla(at, sesion({ verse: plantilla("coordinacion-aseo").casillas }), "verse", "verse-host", def, HOY);
    expect(at.consultas[0]!.campos).not.toContain("Total_H");
    expect(at.consultas[0]!.campos).not.toContain("Nombre");
    expect(at.consultas[0]!.campos).toContain("Código");
    expect(r.ocultos).toEqual(["montos", "datos de terceros"]);
    expect(r.columnas.map((c) => c.campo)).not.toContain("Total_H");
    expect(r.filas[0]!.celdas).not.toHaveProperty("Total_H");
  });

  it("códigos 'solo en su turno' no salen en una lista", () => {
    const aseo = sesion({ verse: plantilla("aseo").casillas });
    const { visibles } = columnasPermitidas(aseo, "verse", "verse-host", TABLAS_EQUIPO.operacion!.detalle!);
    expect(visibles.map((c) => c.campo)).not.toContain("Código");
  });

  it("el Maestro ve todo y Airtable ordena", async () => {
    const at = new AirtableFalso();
    const def = TABLAS_EQUIPO.operacion!;
    await leerTabla(at, maestro, "verse", "verse-host", def, HOY, leerPeriodo("mes", undefined, HOY));
    expect(at.consultas[0]!.campos).toEqual(expect.arrayContaining(["Total_H", "Nombre", "Pass WIFI"]));
    expect(at.consultas[0]!.orden).toEqual({ campo: "Ingreso", desc: false });
    // Reservas que se cruzan con el mes actual.
    expect(at.consultas[0]!.formula).toContain("< 20261201");
    expect(at.consultas[0]!.formula).toContain("{Salida} = BLANK()");
  });

  it("ninguna tabla pide credenciales de plataformas ni cuentas bancarias", () => {
    const prohibidos = /RNT|FONTUR|Pago · |# Cuenta|^Cuenta$|^Banco$|Cédula|Documento/;
    for (const [tipo, def] of Object.entries(TABLAS_EQUIPO)) {
      for (const c of [...def.columnas, ...(def.detalle ?? [])]) expect(prohibidos.test(c.campo), `${tipo}: ${c.campo}`).toBe(false);
    }
  });

  it("todo campo de dinero está marcado como cifras", () => {
    for (const def of Object.values(TABLAS_EQUIPO)) for (const c of [...def.columnas, ...(def.detalle ?? [])]) if (c.tipo === "dinero") expect(c.sensible).toBe("cifras");
  });
});
