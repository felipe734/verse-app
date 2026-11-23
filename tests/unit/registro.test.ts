import { describe, expect, it } from "vitest";
import { ESTRUCTURA } from "@/lib/acceso/estructura";
import type { Sesion } from "@/lib/acceso/permisos";
import { PLANTILLAS, plantilla } from "@/lib/acceso/plantillas";
import { estadoModulos, inicioDe, navegacion, REGISTRO, TODAS, ubicar } from "@/lib/modulos/registro";

const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "00000000-0000-0000-0000-000000000004",
  correo: "p@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Prueba",
  accesos,
  estructura: ESTRUCTURA,
  ...extra,
});
const maestro = sesion({}, { maestro: true });
const hrefs = (s: Sesion, e: string) => navegacion(s, ESTRUCTURA, e).flatMap((g) => g.items.map((i) => i.href));

describe("registro de módulos", () => {
  it("cada módulo de la estructura tiene un tipo del registro", () => {
    const tipos = new Set(REGISTRO.map((d) => d.tipo));
    for (const e of ESTRUCTURA) for (const v of e.verticales) for (const m of v.modulos) expect(tipos.has(m.tipo ?? ""), m.id).toBe(true);
  });

  it("el Maestro ve los módulos construidos agrupados por vertical, con rutas /empresa/vertical/modulo", () => {
    const g = navegacion(maestro, ESTRUCTURA, "verse");
    expect(g.map((x) => x.nombre)).toEqual(["General", "Host", "Living"]);
    expect(hrefs(maestro, "verse")).toEqual([
      "/verse/general/hoy", "/verse/general/aprobar", "/verse/general/correo", "/verse/general/finanzas", "/verse/general/equipo", "/verse/general/sistema",
      "/verse/host/operacion", "/verse/host/limpiezas", "/verse/host/ruta", "/verse/host/unidades", "/verse/host/liquidaciones", "/verse/host/alistamiento", "/verse/host/comercial",
      "/verse/living/unidades", "/verse/living/contratos", "/verse/living/cobros", "/verse/living/comercial",
    ]);
    expect(hrefs(maestro, "cyc")).toEqual(["/cyc/general/hoy", "/cyc/general/aprobar", "/cyc/general/correo", "/cyc/general/finanzas", "/cyc/general/sistema", "/cyc/obra/actas", "/cyc/obra/pagos", "/cyc/obra/contratistas", "/cyc/obra/calidad"]);
  });

  it("un módulo sin construir no aparece en la barra ni se puede abrir, pero sí en Ajustes como no disponible", () => {
    expect(hrefs(maestro, "cyc")).not.toContain("/cyc/obra/diseno");
    expect(ubicar(maestro, ESTRUCTURA, "cyc", "obra", "diseno")).toBeNull();
    const obra = estadoModulos(ESTRUCTURA)[1]!.verticales.find((v) => v.id === "cyc-obra")!;
    expect(obra.modulos.find((m) => m.tipo === "diseno")?.disponible).toBe(false);
    expect(obra.modulos.find((m) => m.tipo === "actas")?.disponible).toBe(true);
  });

  it("Todas solo trae Hoy y Para aprobar", () => {
    expect(hrefs(maestro, TODAS)).toEqual(["/todas/general/hoy", "/todas/general/aprobar"]);
    expect(ubicar(maestro, ESTRUCTURA, TODAS, "general", "correo")).toBeNull();
  });

  describe("por plantilla, nada fuera de su acceso", () => {
    const esperado: Record<string, string[]> = {
      "administrador-verse": [
        "/verse/general/hoy", "/verse/general/correo", "/verse/general/finanzas", "/verse/general/sistema",
        "/verse/host/operacion", "/verse/host/limpiezas", "/verse/host/ruta", "/verse/host/unidades", "/verse/host/liquidaciones", "/verse/host/alistamiento", "/verse/host/comercial",
        "/verse/living/unidades", "/verse/living/contratos", "/verse/living/cobros", "/verse/living/comercial",
      ],
      "coordinacion-aseo": ["/verse/general/hoy", "/verse/host/operacion", "/verse/host/limpiezas", "/verse/host/ruta", "/verse/host/unidades"],
      living: ["/verse/general/hoy", "/verse/general/correo", "/verse/living/unidades", "/verse/living/contratos", "/verse/living/cobros", "/verse/living/comercial"],
      comercial: ["/verse/general/hoy", "/verse/general/correo", "/verse/host/comercial", "/verse/living/comercial"],
      // Aseo solo ve su ruta.
      aseo: ["/verse/host/ruta"],
      // En C&C, Para aprobar va con Hoy (lib/hoy/aprobar.ts): lo ve, pero solo responde con la casilla Aprobar.
      obra: ["/cyc/general/hoy", "/cyc/general/aprobar", "/cyc/general/correo", "/cyc/obra/actas", "/cyc/obra/pagos", "/cyc/obra/contratistas", "/cyc/obra/calidad"],
    };
    for (const p of PLANTILLAS) {
      it(p.nombre, () => {
        const s = sesion({ [p.empresa]: p.casillas });
        expect(hrefs(s, p.empresa)).toEqual(esperado[p.id]);
        const otra = p.empresa === "verse" ? "cyc" : "verse";
        expect(hrefs(s, otra)).toEqual([]);
        expect(ubicar(s, ESTRUCTURA, otra, "general", "hoy")).toBeNull();
      });
    }
  });

  it("Para aprobar aparece con la casilla Aprobar aunque el módulo no esté marcado", () => {
    const s = sesion({ verse: { ...plantilla("living").casillas, aprobar: true } });
    expect(hrefs(s, "verse")).toContain("/verse/general/aprobar");
  });

  it("la primera pantalla es Hoy de la primera empresa con acceso", () => {
    expect(inicioDe(sesion({ cyc: plantilla("obra").casillas }), ESTRUCTURA, ["cyc"])).toBe("/cyc/general/hoy");
    expect(inicioDe(sesion({ verse: plantilla("aseo").casillas }), ESTRUCTURA, ["verse"])).toBe("/verse/host/ruta");
  });
});
