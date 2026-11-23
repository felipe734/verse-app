import { expect, test } from "@playwright/test";


test.beforeEach(async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "maestro", url: baseURL! }]);
});

test("Hoy carga en /verse/general/hoy con la barra por vertical", async ({ page, isMobile }) => {
  await page.goto("/hoy");
  await expect(page).toHaveURL(/\/verse\/general\/hoy$/);
  await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Crítico/ })).toBeVisible();
  if (!isMobile) {
    const barra = page.locator("[data-sidebar=sidebar]");
    await expect(barra.getByText("General")).toBeVisible();
    await expect(barra.getByRole("link", { name: "Para aprobar" })).toBeVisible();
    await expect(barra.getByRole("link", { name: "Ajustes" })).toBeVisible();
  }
});

test("el detalle se abre en panel lateral", async ({ page }) => {
  await page.goto("/verse/general/hoy");
  await page.getByRole("button", { name: /Póliza de la unidad 603 Pagar/ }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Fila en Airtable")).toBeVisible();
  await expect(panel).toHaveAttribute("data-seleccion", /fila \d+ de Verse/);
});

test("⌘K busca pendientes y lleva a la fila", async ({ page, isMobile }) => {
  test.skip(isMobile, "El atajo de teclado es de computador");
  await page.goto("/verse/general/hoy");
  await page.getByRole("button", { name: /Buscar/ }).click();
  await page.keyboard.press("Escape");
  // Con la página hidratada, el atajo abre la paleta.
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder(/Busca un módulo/).fill("lencer");
  await page.getByRole("option", { name: /Lencería para dos unidades/ }).click();
  await expect(page).toHaveURL(/fila=rec/);
  await expect(page.getByRole("dialog").getByText("Lencería para dos unidades")).toBeVisible();
});

test("Todas junta Verse y C&C en Hoy", async ({ page }) => {
  await page.goto("/todas/general/hoy");
  await expect(page.getByText("Acta de corte 7")).toBeVisible();
  await expect(page.getByText("Póliza de la unidad 603")).toBeVisible();
});

test("coordinación de aseo no ve Correo, Ajustes ni Para aprobar de Verse", async ({ page, baseURL, isMobile }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "aseo@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/general/hoy");
  await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
  // Lo suyo: solo Alejandra.
  await expect(page.getByText("Programación de limpiezas")).toBeVisible();
  await expect(page.getByText("Póliza de la unidad 603")).toHaveCount(0);
  if (!isMobile) {
    const barra = page.locator("[data-sidebar=sidebar]");
    await expect(barra.getByRole("link", { name: "Correo" })).toHaveCount(0);
    await expect(barra.getByRole("link", { name: "Ajustes" })).toHaveCount(0);
  }
  await page.goto("/verse/general/aprobar");
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
});

test("un módulo sin construir no se abre y una empresa ajena lleva al inicio", async ({ page }) => {
  await page.goto("/cyc/obra/diseno");
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
  await page.goto("/otra/general/hoy");
  await expect(page).toHaveURL(/\/verse\/general\/hoy$/);
});

test("Correo abre el hilo en panel lateral, en texto", async ({ page }) => {
  await page.goto("/verse/general/correo");
  await expect(page.getByRole("heading", { name: "Correo", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /Estado de cuenta de noviembre/ }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText(/Adjuntamos el estado de cuenta/)).toBeVisible();
  await expect(panel).toHaveAttribute("data-seleccion", /hilo 1a2000000000a01 de la cuenta verse-felipe/);
});

test("el administrador de Verse solo lee contabilidad@ y contacto@", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "admin@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/general/correo");
  await expect(page.getByText("Quiero poner mi apartamento en arriendo")).toBeVisible();
  await expect(page.getByText("Estado de cuenta de noviembre")).toHaveCount(0);
});

test("Sistema muestra indicadores y corridas", async ({ page }) => {
  await page.goto("/sistema");
  await expect(page).toHaveURL(/\/verse\/general\/sistema$/);
  await expect(page.getByText("Fallas en 7 días")).toBeVisible();
});

test("Ajustes: usuarios, empresas con acento y módulos no disponibles", async ({ page, isMobile }) => {
  await page.goto("/ajustes");
  await expect(page.getByRole("heading", { name: "Ajustes", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana Prueba" })).toBeVisible();
  await page.getByRole("link", { name: "Empresas y módulos" }).click();
  await expect(page.getByText("No disponible").first()).toBeVisible();
  if (!isMobile) await expect(page.getByLabel("Elegir color").first()).toBeVisible();
});

test("Ajustes es solo para el Maestro", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "admin@vitrina.test", url: baseURL! }]);
  await page.goto("/ajustes");
  await expect(page.getByText("Ajustes es solo para el Maestro.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana Prueba" })).toHaveCount(0);
});

test("un módulo de tabla oculta montos y terceros según la plantilla", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "aseo@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/host/operacion");
  await expect(page.getByRole("heading", { name: "Operación", level: 1 })).toBeVisible();
  await expect(page.getByText(/Tu acceso no incluye montos, datos de terceros/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Total" })).toHaveCount(0);
});

test("el Maestro abre el detalle de una fila de tabla", async ({ page }) => {
  await page.goto("/cyc/obra/actas?v=lista");
  await expect(page.getByRole("heading", { name: "Actas", level: 1 })).toBeVisible();
  await page.locator("table:not(.sr-only) tbody tr").first().click();
  await expect(page.getByRole("dialog").getByText("A pagar", { exact: true })).toBeVisible();
});

test("Finanzas de Verse muestra el cierre y cambia de pestaña", async ({ page }) => {
  await page.goto("/verse/general/finanzas");
  await expect(page.getByRole("heading", { name: "Finanzas", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cierre del mes" }).getByText("Margen neto").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Movimientos" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Cruces" }).click();
  await expect(page).toHaveURL(/pestana=cruces/);
  await expect(page.getByRole("link", { name: "Cruces" })).toHaveAttribute("aria-current", "page");
});

test("Finanzas C&C no muestra números de cuenta", async ({ page, isMobile }) => {
  await page.goto("/cyc/general/finanzas?pestana=referencias");
  await expect(page.getByRole("link", { name: "Referencias bancarias" })).toHaveAttribute("aria-current", "page");
  if (!isMobile) await expect(page.getByRole("button", { name: "Tipo de cuenta" })).toBeVisible();
  await expect(page.getByText("# CUENTA")).toHaveCount(0);
});

test("la funcionaria ve su ruta de hoy y el turno; sin turno no hay códigos ni reporte", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "edy@vitrina.test", url: baseURL! }]);
  await page.goto("/hoy");
  await expect(page).toHaveURL(/\/verse\/host\/ruta$/);
  await expect(page.getByRole("heading", { name: "Ruta de aseo", level: 1 })).toBeVisible();
  await expect(page.getByText("Sin turno abierto")).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar turno" })).toBeVisible();
  const lista = page.getByRole("list", { name: "Limpiezas de hoy" });
  await expect(lista.getByText("Parque 1104")).toBeVisible();
  await expect(page.getByText("1 de 3 limpiezas terminadas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingreso" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reportar" }).first()).toBeDisabled();
});

test("quien coordina ve la ruta de todas", async ({ page }) => {
  await page.goto("/verse/host/ruta");
  await expect(page.getByRole("region", { name: "Ruta de Edy Prueba" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ruta de Sara Prueba" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar turno" })).toHaveCount(0);
});

test("en un módulo con editar, el detalle abre el formulario con las opciones de Airtable", async ({ page }) => {
  await page.goto("/verse/host/limpiezas?v=lista");
  await page.locator("table:not(.sr-only) tbody tr").first().click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Editar" }).click();
  const form = panel.getByRole("form", { name: "Editar fila" });
  await expect(form.getByRole("combobox")).toHaveValue("Pendiente");
  await expect(form.getByRole("option", { name: "Hecho" })).toBeAttached();
  await expect(form.getByRole("button", { name: "Guardar" })).toBeVisible();
});

test("con el módulo solo en ver no aparece Editar", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "admin@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/general/finanzas");
  await page.locator("table:not(.sr-only) tbody tr").first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Editar" })).toHaveCount(0);
});

test("el Maestro registra un gasto de caja menor desde Finanzas", async ({ page }) => {
  await page.goto("/verse/general/finanzas?pestana=caja");
  await page.getByRole("button", { name: "Nuevo gasto" }).click();
  const form = page.getByRole("form", { name: "Nuevo gasto" });
  await expect(form.getByText("Concepto")).toBeVisible();
  await expect(form.getByRole("combobox")).toBeVisible();
});

test("con Finanzas solo en ver no aparece Nuevo gasto", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "admin@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/general/finanzas?pestana=caja");
  await expect(page.getByRole("heading", { name: "Finanzas", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuevo gasto" })).toHaveCount(0);
});

test("las vistas abren en el período actual, filtran, cambian a tablero y se guardan", async ({ page, isMobile }) => {
  await page.goto("/verse/host/limpiezas");
  const periodo = page.getByRole("group", { name: "Período" });
  await expect(periodo).toBeVisible();
  await expect(page.getByRole("button", { name: "Esta semana" })).toHaveCount(0);
  await expect(page.getByRole("definition").first()).toBeVisible();
  await periodo.getByRole("link", { name: "Período anterior" }).click();
  await expect(page).toHaveURL(/p=\d{4}-W\d{2}/);
  await expect(page.getByRole("link", { name: "Esta semana" })).toBeVisible();

  await page.getByRole("button", { name: /Estado:/ }).first().click();
  await page.getByRole("menuitemcheckbox", { name: "Pendiente" }).click();
  await expect(page).toHaveURL(/f\.Estado=Pendiente/);
  await page.getByRole("radio", { name: "Tablero" }).click();
  await expect(page.getByLabel("Tablero por Estado")).toBeVisible();

  if (!isMobile) {
    await page.getByRole("button", { name: "Vistas" }).click();
    await page.getByLabel("Nombre de la vista").fill("Pendientes");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText('Vista "Pendientes" guardada')).toBeVisible();
  }
});

test("Operación abre en el calendario del mes y Limpiezas en la agenda de la semana", async ({ page, isMobile }) => {
  await page.goto("/verse/host/operacion");
  await expect(page.getByRole("radio", { name: "Calendario" })).toHaveAttribute("aria-checked", "true");
  if (isMobile) await expect(page.getByRole("list", { name: "Agenda de reservas" })).toBeVisible();
  else {
    const cal = page.getByRole("grid", { name: "Calendario de reservas" });
    await expect(cal.getByRole("rowheader").first()).toBeVisible();
    await cal.getByRole("button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
  await page.goto("/verse/host/limpiezas");
  await expect(page.getByRole("radio", { name: "Agenda" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel(isMobile ? "Agenda por día" : "Agenda de la semana")).toBeVisible();
});

test("Living: contratos en calendario del mes y cobros en tablero", async ({ page, isMobile }) => {
  await page.goto("/verse/living/contratos");
  await expect(page.getByRole("radio", { name: "Calendario" })).toHaveAttribute("aria-checked", "true");
  if (!isMobile) await expect(page.getByText("Terminan hoy")).toBeVisible();
  await page.goto("/verse/living/cobros");
  await expect(page.getByRole("radio", { name: "Tablero" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("definition").filter({ hasText: "$" }).first()).toBeVisible();
});

test("Inicio muestra lo de hoy y una tarjeta por módulo con sus cifras", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Buen(os|as) .*, /);
  await expect(page.getByRole("region", { name: "Para hoy" }).getByText("Críticos")).toBeVisible();
  const host = page.getByRole("main").getByRole("link", { name: /Operación/ });
  await expect(host.getByText("Reservas")).toBeVisible();
  await host.click();
  await expect(page).toHaveURL(/\/verse\/host\/operacion/);
});

test("aseo entra directo a su ruta desde Inicio", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "edy@vitrina.test", url: baseURL! }]);
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/verse\/host\/ruta$/);
});

test("con alcance 'lo suyo' los módulos abren en Mío y se puede ver Todo", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "aseo@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/host/limpiezas?v=lista");
  await expect(page.getByRole("radio", { name: "Mío" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("0 filas")).toBeVisible();
  await page.getByRole("radio", { name: "Todo" }).click();
  await expect(page).toHaveURL(/quien=todo/);
  await expect(page.getByText("8 filas")).toBeVisible();
});

test("el Maestro abre en Todo", async ({ page }) => {
  await page.goto("/verse/host/limpiezas?v=lista");
  await expect(page.getByRole("radio", { name: "Todo" })).toHaveAttribute("aria-checked", "true");
});

test("acciones de un toque: Terminada en la agenda y en el detalle; el tablero se puede arrastrar", async ({ page, isMobile }) => {
  await page.goto("/verse/host/limpiezas");
  if (!isMobile) await expect(page.getByRole("button", { name: /^Terminada: / }).first()).toBeVisible();
  await page.goto("/verse/host/limpiezas?v=lista");
  await page.locator("table:not(.sr-only) tbody tr").first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Terminada" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/verse/host/limpiezas?v=tablero");
  await expect(page.getByLabel("Tablero por Estado").getByRole("button").first()).toHaveAttribute("draggable", "true");
});

test("sin editar no hay acciones de un toque", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "vitrina_usuario", value: "admin@vitrina.test", url: baseURL! }]);
  await page.goto("/verse/general/finanzas");
  await page.locator("table:not(.sr-only) tbody tr").first().click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Conciliado" })).toHaveCount(0);
});
