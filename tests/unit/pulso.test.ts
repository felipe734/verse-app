import { describe, expect, it } from "vitest";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { ids } from "@/lib/modulos/tablas-equipo";
import { calcularPulso, pulsoHost } from "@/lib/pulso/host";
import { AirtableFalso } from "../apoyo/airtable-falso";

const maestro: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000010", correo: "m@prueba.co", estado: "activo", maestro: true, nombreAirtable: "Felipe", accesos: {}, estructura: ESTRUCTURA };
const HOY = "2026-11-25";
const reg = (fields: Record<string, unknown>, i = 0) => ({ id: `rec${i}`, createdTime: "", fields });
const ENLACES = { operacion: "/verse/host/operacion", limpiezas: "/verse/host/limpiezas" };

describe("pulso de Host", () => {
  it("ocupación es la noche de hoy dentro de la reserva; el día de salida ya no cuenta", () => {
    const p = calcularPulso(
      [
        reg({ Unidad: "A", Ingreso: "2026-11-24", Salida: "2026-11-26" }),
        reg({ Unidad: "B", Ingreso: "2026-11-20", Salida: "2026-11-25" }),
        reg({ Unidad: "C", Ingreso: "2026-11-25", Salida: "2026-11-27", "Hora Ingreso": "3:00 PM" }),
        reg({ Unidad: "D", Ingreso: "2026-11-26", Salida: "2026-11-28" }),
      ],
      [],
      10,
      HOY,
      ENLACES,
    );
    expect(p.ocupadas).toBe(2);
    expect(p.activas).toBe(10);
    expect(p.hoy.entradas).toEqual([{ unidad: "C", hora: "3:00 p. m." }]);
    expect(p.hoy.salidas.map((s) => s.unidad)).toEqual(["B"]);
    expect(p.manana.entradas.map((s) => s.unidad)).toEqual(["D"]);
    expect(p.manana.salidas.map((s) => s.unidad)).toEqual(["A"]);
  });

  it("aseos del día: terminados y sin aseadora", () => {
    const p = calcularPulso(
      [],
      [
        reg({ Unidad: "A", Fecha: "25/11/2026 9:00am", Funcionario: "Edy", Estado: "Terminado" }),
        reg({ Unidad: "B", Fecha: "25/11/2026 11:00am", Funcionario: "", Estado: "Programado" }),
        reg({ Unidad: "C", Fecha: "26/11/2026 11:00am", Funcionario: "", Estado: "Programado" }),
      ],
      null,
      HOY,
      ENLACES,
    );
    expect(p.hoy.aseos).toEqual({ total: 2, terminados: 1, sinFuncionaria: ["B"] });
    expect(p.manana.aseos?.sinFuncionaria).toEqual(["C"]);
  });

  it("sin Limpiezas no hay aseos; sin Operación no hay pulso", async () => {
    const at = new AirtableFalso();
    const R = ids("6. OPERACION 360", "RESERVAS");
    at.poner(R.idBase, R.idTabla, { Unidad: "A", Ingreso: "24/11/2026", Salida: "26/11/2026" });
    const p = await pulsoHost({ airtable: at, s: maestro, estructura: ESTRUCTURA, hoy: HOY });
    expect(p?.ocupadas).toBe(1);
    expect(p?.enlaces.limpiezas).toBe("/verse/host/limpiezas");
    const aseo: Sesion = { ...maestro, maestro: false, accesos: { verse: plantilla("aseo").casillas } };
    expect(await pulsoHost({ airtable: at, s: aseo, estructura: ESTRUCTURA, hoy: HOY })).toBeNull();
  });
});
