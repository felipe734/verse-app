import { describe, expect, it } from "vitest";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { alertasDe } from "@/lib/alertas/operacion";
import { ids } from "@/lib/modulos/tablas-equipo";
import { AirtableFalso } from "../apoyo/airtable-falso";

const maestro: Sesion = { usuarioId: "00000000-0000-0000-0000-000000000010", correo: "m@prueba.co", estado: "activo", maestro: true, nombreAirtable: "Felipe", accesos: {}, estructura: ESTRUCTURA };
const HOY = "2026-11-25";

describe("alertas de la operación", () => {
  it("una salida sin limpieza en su fecha es alerta; con limpieza ese día, no", async () => {
    const at = new AirtableFalso();
    const R = ids("6. OPERACION 360", "RESERVAS");
    const L = ids("6. OPERACION 360", "LIMPIEZA");
    at.poner(R.idBase, R.idTabla, { Unidad: "Torre 603", Salida: "26/11/2026" });
    at.poner(R.idBase, R.idTabla, { Unidad: "Torre 805", Salida: "27/11/2026" });
    at.poner(L.idBase, L.idTabla, { Unidad: "Torre 805", Fecha: "27/11/2026 11:00am", Funcionario: "Edy" });
    const r = await alertasDe({ airtable: at, s: maestro, estructura: ESTRUCTURA, hoy: HOY }, "limpiezas");
    const a = r.find((x) => x.id === "reservas-sin-limpieza");
    expect(a).toMatchObject({ cuenta: 1, href: "/verse/host/limpiezas" });
    expect(a?.detalle).toContain("Torre 603 (26)");
  });

  it("solo para quien ve el módulo", async () => {
    const at = new AirtableFalso();
    const I = ids("7. LIVING", "INGRESOS");
    at.poner(I.idBase, I.idTabla, { Unidad: "Living 201" });
    const aseo: Sesion = { ...maestro, maestro: false, accesos: { verse: plantilla("aseo").casillas } };
    expect(await alertasDe({ airtable: at, s: aseo, estructura: ESTRUCTURA, hoy: HOY })).toEqual([]);
    expect((await alertasDe({ airtable: at, s: maestro, estructura: ESTRUCTURA, hoy: HOY }, "cobros"))[0]).toMatchObject({ id: "cobros-vencidos", cuenta: 1 });
  });
});
