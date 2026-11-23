import { beforeEach, describe, expect, it } from "vitest";
import type { Sesion } from "@/lib/acceso/permisos";
import { plantilla } from "@/lib/acceso/plantillas";
import { bandejaDe, cuentasLegibles, hiloDe } from "@/lib/correo/bandeja";
import { olvidarCuentas, resolverCuentas } from "@/lib/correo/cuentas";
import { lineaDe, rutear, type CorreoParaRutear } from "@/lib/correo/ruteo";
import { ComposioFalso, mensaje } from "../apoyo/composio-falso";

const sesion = (accesos: Sesion["accesos"], extra: Partial<Sesion> = {}): Sesion => ({
  usuarioId: "00000000-0000-0000-0000-000000000003",
  correo: "p@prueba.co",
  estado: "activo",
  maestro: false,
  nombreAirtable: "Prueba",
  accesos,
  ...extra,
});
const maestro = sesion({}, { maestro: true });

const r = (c: Partial<CorreoParaRutear>) => rutear({ cuenta: "verse-felipe", de: "alguien@ejemplo.co", asunto: "", vista: "", etiquetas: [], ...c });

describe("ruteo de os-correo", () => {
  it("alerta de seguridad va a sistema de la empresa de la cuenta y no se responde", () => {
    expect(r({ cuenta: "cyc-comercial", de: "Google <no-reply@accounts.google.com>", asunto: "Alerta de seguridad" })).toMatchObject({ os: "cyc", cola: "sistema", regla: "C1", responde: false });
  });

  it("factura electrónica va a la contabilidad de la receptora, aunque llegue a otra cuenta", () => {
    const f = r({ cuenta: "verse-contacto", asunto: "900123456;Proveedor SAS;FE-12;01;Proveedor SAS", vista: "Estimado C&C GROUP SAS, adjuntamos" });
    expect(f).toMatchObject({ os: "cyc", cola: "contabilidad", regla: "C2" });
    expect(r({ cuenta: "cyc-contabilidad", de: "facturacion@taxxa.co", asunto: "Factura", vista: "para VERSE GROUP SAS" })).toMatchObject({ os: "verse", regla: "C2" });
  });

  it("reservas y huéspedes van a Verse Host; pólizas SafeTrip no se responden", () => {
    expect(r({ de: "Airbnb <automated@airbnb.com>", asunto: "Reserva confirmada" })).toMatchObject({ os: "verse", cola: "host", regla: "C3" });
    expect(r({ de: "secretaria.general@ranharvey.com", asunto: "POLIZAS SAFETRIP VERSE LIVING" })).toMatchObject({ cola: "host", regla: "C3b", responde: false });
  });

  it("obra va a C&C, pero un arrendatario de Balcony va a Verse Living", () => {
    expect(r({ cuenta: "cyc-comercial", asunto: "Acta de obra corte 7 Balcony 2" })).toMatchObject({ os: "cyc", cola: "obra", regla: "C4" });
    expect(r({ cuenta: "cyc-comercial", asunto: "Arrendatario apto 302 Balcony 2" })).toMatchObject({ os: "verse", cola: "living", regla: "C5" });
  });

  it("las firmas de AFFI son ruido; otro correo de AFFI va a Living", () => {
    expect(r({ de: "AFFI <firmas@affi.net>", asunto: "Firma pendiente: Contrato de fianza colectiva" })).toMatchObject({ os: "ruido", regla: "C6a" });
    expect(r({ de: "AFFI <siniestros@affi.net>", asunto: "Siniestro apto 504" })).toMatchObject({ os: "verse", cola: "living", regla: "C6" });
  });

  it("bancos van a la contabilidad de la empresa de la cuenta", () => {
    expect(r({ cuenta: "cyc-contabilidad", de: "Global66 <no-reply@global66.com>", asunto: "Recibiste una transferencia" })).toMatchObject({ os: "cyc", cola: "contabilidad", regla: "C8" });
  });

  it("códigos de verificación van a sistema", () => {
    expect(r({ cuenta: "verse-contacto", de: "respond.io <no-reply@notifications.respond.io>", asunto: "Your Verification Code: 123456" })).toMatchObject({ cola: "sistema", regla: "C11", responde: false });
  });

  it("promociones son ruido y sin regla manda la cuenta", () => {
    expect(r({ asunto: "Descuentos de fin de año", etiquetas: ["CATEGORY_PROMOTIONS"] })).toMatchObject({ os: "ruido", regla: "C13" });
    expect(r({ cuenta: "verse-contacto", asunto: "Hola, una pregunta" })).toMatchObject({ os: "verse", cola: "comercial", regla: "cuenta" });
  });

  it("la línea de TRAZABILIDAD sale del OS y la cola", () => {
    expect(lineaDe({ os: "verse", cola: "host", regla: "C3", responde: true })).toBe("Verse Host");
    expect(lineaDe({ os: "cyc", cola: "obra", regla: "C4", responde: true })).toBe("Balcony");
    expect(lineaDe({ os: "verse", cola: "svmg", regla: "C10", responde: true })).toBe("Grupo");
  });
});

describe("cuentas", () => {
  it("reconoce por alias o nombre gmail_…; la personal no entra; avisa las que faltan", async () => {
    const { mapa, faltan } = await resolverCuentas(new ComposioFalso());
    expect(mapa.get("verse-contacto")).toBe("ca_contacto");
    expect([...mapa.values()]).not.toContain("ca_personal");
    expect(faltan).toEqual(["cyc-contabilidad"]);
  });

  it("una cuenta inactiva no se usa", async () => {
    const c = new ComposioFalso();
    c.conectadas[0]!.estado = "EXPIRED";
    expect((await resolverCuentas(c)).mapa.has("verse-felipe")).toBe(false);
  });
});

describe("bandeja", () => {
  let c: ComposioFalso;
  beforeEach(() => {
    olvidarCuentas();
    c = new ComposioFalso();
    c.buzones.set("ca_felipe", [mensaje({ de: "Airbnb <automated@airbnb.com>", asunto: "Nueva reserva Teik 603" }), mensaje({ de: "Tienda <promo@tienda.co>", asunto: "Oferta", etiquetas: ["CATEGORY_PROMOTIONS"] })]);
    c.buzones.set("ca_contacto", [mensaje({ de: "Lead <lead@ejemplo.co>", asunto: "Quiero arrendar mi apartamento con ustedes" })]);
    c.buzones.set("ca_cyc", [mensaje({ de: "GM Construcciones <gm@ejemplo.co>", asunto: "Corte de obra 8" })]);
  });

  it("el Maestro ve las cuentas conectadas, ruteadas por cola, y el ruido solo se cuenta", async () => {
    const b = await bandejaDe(c, maestro);
    expect(b.colas.map((x) => x.id).sort()).toEqual(["cyc·obra", "verse·comercial", "verse·host"]);
    expect(b.ruido).toBe(1);
    expect(b.avisos).toEqual(["La cuenta cyc-contabilidad no está conectada en Composio."]);
    // Cada lectura lleva la cuenta explícita y nunca la personal.
    expect(c.llamadas.every((l) => l.cuenta && l.cuenta !== "ca_personal")).toBe(true);
    expect(c.llamadas[0]!.argumentos).toMatchObject({ verbose: false, include_payload: false });
  });

  it("Living solo lee contacto@", async () => {
    const living = sesion({ verse: plantilla("living").casillas });
    expect(cuentasLegibles(living).map((x) => x.id)).toEqual(["verse-contacto"]);
    const b = await bandejaDe(c, living);
    expect(c.llamadas.map((l) => l.cuenta)).toEqual(["ca_contacto"]);
    expect(b.avisos).toEqual([]);
  });

  it("sin módulo Correo no lee ninguna cuenta", async () => {
    const aseo = sesion({ verse: { ...plantilla("coordinacion-aseo").casillas, correo: { "verse-felipe": "leer" } } });
    expect(cuentasLegibles(aseo)).toEqual([]);
  });

  it("el mismo correo en dos cuentas sale una vez", async () => {
    const m = mensaje({ de: "Serconfis <info@serconfis.co>", asunto: "Retención en la fuente" });
    c.buzones.set("ca_felipe", [m]);
    c.buzones.set("ca_conta", [{ ...m, messageId: "1a2ffffffffffff" }]);
    const b = await bandejaDe(c, maestro);
    const todos = b.colas.flatMap((x) => x.items).filter((x) => x.de.startsWith("Serconfis"));
    expect(todos).toHaveLength(1);
    expect(todos[0]!.tambienEn).toEqual(["verse-contabilidad"]);
  });

  it("una cuenta que falla no tumba las demás", async () => {
    c.fallaEn = "ca_cyc";
    const b = await bandejaDe(c, maestro);
    expect(b.avisos.some((a) => a.startsWith("No se pudo leer comercial@"))).toBe(true);
    expect(b.colas.some((x) => x.id === "verse·host")).toBe(true);
  });
});

describe("hilo", () => {
  it("solo con acceso a la cuenta, y sin borradores", async () => {
    olvidarCuentas();
    const c = new ComposioFalso();
    c.hilos.set("1a2063103bb432fa", [
      { messageId: "a", sender: "x@ejemplo.co", subject: "Hola", messageTimestamp: "2026-11-22T10:00:00Z", labelIds: ["INBOX"], messageText: "Texto &amp; más" },
      { messageId: "b", sender: "yo", subject: "Re: Hola", messageTimestamp: "2026-11-22T11:00:00Z", labelIds: ["DRAFT"], messageText: "borrador" },
    ]);
    const living = sesion({ verse: plantilla("living").casillas });
    expect(await hiloDe(c, living, "verse-felipe", "1a2063103bb432fa")).toEqual({ error: "Sin acceso a esa cuenta." });
    const h = await hiloDe(c, maestro, "verse-felipe", "1a2063103bb432fa");
    expect("mensajes" in h && h.mensajes.map((m) => m.texto)).toEqual(["Texto & más"]);
    expect(await hiloDe(c, maestro, "verse-felipe", "../otra")).toEqual({ error: "Hilo inválido." });
  });
});
