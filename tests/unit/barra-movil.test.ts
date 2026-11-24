import { describe, expect, it } from "vitest";
import { accesosMovil, rolMovil } from "@/lib/modulos/barra-movil";
import type { ItemNav } from "@/lib/modulos/registro";

const item = (tipo: string): ItemNav => ({ id: tipo, tipo, nombre: tipo, icono: "x", href: `/verse/general/${tipo}` });
const tipos = (xs: ItemNav[]) => xs.map((i) => i.tipo);

describe("barra del celular por rol", () => {
  it("distingue maestro, aseo y equipo", () => {
    expect(rolMovil(true, [item("ruta")])).toBe("maestro");
    expect(rolMovil(false, [item("ruta")])).toBe("aseo");
    expect(rolMovil(false, [item("hoy"), item("ruta")])).toBe("equipo");
    expect(rolMovil(false, [item("hoy"), item("cobros")])).toBe("equipo");
  });

  it("el maestro ve Inicio, Finanzas y Hoy", () => {
    const xs = [item("hoy"), item("correo"), item("finanzas"), item("limpiezas")];
    expect(tipos(accesosMovil("maestro", xs))).toEqual(["inicio", "finanzas", "hoy"]);
  });

  it("el equipo ve su módulo de operación en el tercer puesto", () => {
    const xs = [item("hoy"), item("correo"), item("cobros"), item("contratos")];
    expect(tipos(accesosMovil("equipo", xs))).toEqual(["inicio", "hoy", "contratos"]);
  });

  it("la funcionaria de aseo abre con su ruta", () => {
    expect(tipos(accesosMovil("aseo", [item("ruta")]))).toEqual(["ruta"]);
    expect(tipos(accesosMovil("aseo", [item("ruta"), item("limpiezas")]))).toEqual(["ruta", "limpiezas"]);
  });

  it("un puesto vacío se llena con lo más usado sin repetir", () => {
    const xs = [item("hoy"), item("correo"), item("sistema")];
    const usos = { "/verse/general/sistema": 5, "/verse/general/correo": 2 };
    expect(tipos(accesosMovil("equipo", xs, usos))).toEqual(["inicio", "hoy", "sistema"]);
    expect(tipos(accesosMovil("maestro", xs, usos))).toEqual(["inicio", "sistema", "hoy"]);
  });
});
