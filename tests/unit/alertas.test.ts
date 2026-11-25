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
    expect(a).toMatchObject({ cuenta: 1, href: "/verse/host/limpiezas?programar=1" });
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
  it("aseos sin aseadora: hoy y mañana en rojo; el resto de la semana como aviso", async () => {
    const at = new AirtableFalso();
    const L = ids("6. OPERACION 360", "LIMPIEZA");
    at.poner(L.idBase, L.idTabla, { Unidad: "Torre 603", Fecha: "26/11/2026 11:00am" });
    at.poner(L.idBase, L.idTabla, { Unidad: "Torre 805", Fecha: "29/11/2026 11:00am" });
    const r = await alertasDe({ airtable: at, s: maestro, estructura: ESTRUCTURA, hoy: HOY }, "limpiezas");
    expect(r.find((a) => a.id === "limpiezas-sin-funcionaria-24h")).toMatchObject({ nivel: "alta", cuenta: 1, detalle: "Hoy y mañana: Torre 603", href: "/verse/host/limpiezas?programar=1" });
    expect(r.find((a) => a.id === "limpiezas-sin-funcionaria")).toMatchObject({ nivel: "media", cuenta: 1 });
  });

  it("arriendo vencido hace más de 5 días en rojo; el reciente como aviso", async () => {
    const at = new AirtableFalso();
    const I = ids("7. LIVING", "INGRESOS");
    at.poner(I.idBase, I.idTabla, { Unidad: "VL 203", Fecha: "5/11/2026" });
    at.poner(I.idBase, I.idTabla, { Unidad: "EB 401", Fecha: "23/11/2026" });
    const r = await alertasDe({ airtable: at, s: maestro, estructura: ESTRUCTURA, hoy: HOY }, "cobros");
    expect(r[0]).toMatchObject({ id: "cobros-vencidos-5d", nivel: "alta", detalle: "VL 203" });
    expect(r[1]).toMatchObject({ id: "cobros-vencidos", nivel: "media", detalle: "EB 401" });
  });

  it("leads de Host sin contactar más de 48 h, con la fórmula de plazo", async () => {
    const at = new AirtableFalso();
    const T = ids("10. LEAD GEN", "LEADS");
    at.poner(T.idBase, T.idTabla, { Nombre: "Lead Prueba" });
    const [a] = await alertasDe({ airtable: at, s: maestro, estructura: ESTRUCTURA, hoy: HOY }, "comercial-host");
    expect(a).toMatchObject({ id: "leads-sin-contacto", nivel: "alta", cuenta: 1, href: "/verse/host/comercial?v=lista&f.Estado=Lead" });
    expect(at.consultas.at(-1)?.formula).toContain("DATEADD(NOW(), -48, 'hours')");
  });

  it("leads de Living sin contactar más de 48 h", async () => {
    const at = new AirtableFalso();
    const T = ids("7. LIVING", "WEB LEADS");
    at.poner(T.idBase, T.idTabla, { Nombre: "Liliana Prueba" });
    const [a] = await alertasDe({ airtable: at, s: maestro, estructura: ESTRUCTURA, hoy: HOY }, "comercial-living");
    expect(a).toMatchObject({ id: "leads-living-sin-contacto", nivel: "alta", cuenta: 1, detalle: "Liliana Prueba", href: "/verse/living/comercial?v=lista&f.Estado=Nuevo" });
    expect(at.consultas.at(-1)?.formula).toContain("{Estado} = 'Nuevo'");
  });

  it("renovaciones sin decidir: a 60 días en rojo, a 90 como aviso", async () => {
    const at = new AirtableFalso();
    const U = ids("7. LIVING", "UNIDADES");
    at.poner(U.idBase, U.idTabla, { Unidad: "VL 301_03", "Fecha Salida": "10/1/2027" });
    at.poner(U.idBase, U.idTabla, { Unidad: "EB 402_01", "Fecha Salida": "15/2/2027" });
    const r = await alertasDe({ airtable: at, s: maestro, estructura: ESTRUCTURA, hoy: HOY }, "unidades-living");
    expect(r[0]).toMatchObject({ id: "renovaciones-60d", nivel: "alta", detalle: "VL 301_03 (10/1/2027)", href: "/verse/living/unidades?v=lista&f.Estado=Actual" });
    expect(r[1]).toMatchObject({ id: "renovaciones-90d", nivel: "media", detalle: "EB 402_01 (15/2/2027)" });
    expect(at.consultas.at(-1)?.formula).toContain("{Renovación} = 'Pendiente'");
  });
});

