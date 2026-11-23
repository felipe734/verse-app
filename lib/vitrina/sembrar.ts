import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db/cliente";
import * as esquema from "@/db/esquema";
import { accesos, tareas, unidades, usuarios } from "@/db/esquema";
import { plantilla } from "@/lib/acceso/plantillas";
import { sembrar } from "@/lib/acceso/sembrar";
import { hoyBogota } from "@/lib/hoy/clasificar";
import { sumarDias } from "@/lib/hoy/fechas";
import { MAESTRO_VITRINA } from "./activa";

/** Base de la vitrina: estructura real de la app y pendientes inventados (sin datos de nadie). */
export async function iniciarVitrina(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema: esquema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: "db/migraciones" });
  await sembrar(db, { correo: MAESTRO_VITRINA, nombre: "Maestro Vitrina" });

  const [admin, coord] = await db
    .insert(usuarios)
    .values([
      { nombre: "Ana Prueba", correo: "admin@vitrina.test", estado: "activo", maestro: false, nombreAirtable: "Diana" },
      { nombre: "Laura Prueba", correo: "aseo@vitrina.test", estado: "activo", maestro: false, nombreAirtable: "Alejandra" },
    ])
    .returning();
  await db.insert(accesos).values([
    { usuarioId: admin!.id, empresaId: "verse", casillas: { ...plantilla("administrador-verse").casillas, asistente: "acciones" } },
    { usuarioId: coord!.id, empresaId: "verse", casillas: plantilla("coordinacion-aseo").casillas },
    { usuarioId: coord!.id, empresaId: "cyc", casillas: plantilla("obra").casillas },
  ]);

  const hoy = hoyBogota();
  let n = 300;
  const fila = (empresa: "Verse" | "C&C", asunto: string, detalle: string, responsable: string, dias: number, proceso: string, extra: Partial<typeof tareas.$inferInsert> = {}) => ({
    recId: `recVITRINA${String(++n).padStart(7, "0")}`,
    empresa,
    numero: n,
    tipo: "Pendiente",
    asunto,
    proceso,
    estado: "Abierto",
    responsable,
    fechaLimite: sumarDias(hoy, dias),
    detalle,
    link: null,
    linea: empresa === "Verse" ? "Grupo" : "C&C",
    corrida: [],
    ...extra,
  });
  await db.insert(tareas).values([
    fila("Verse", "Póliza de la unidad 603", "Crítico: Pagar la póliza antes del ingreso\nEl huésped llega mañana.", "Felipe", 0, "Pólizas", { linea: "Verse Host" }),
    fila("Verse", "Factura de servicios del edificio", "Pagar la factura de acueducto", "Diana", -3, "Recurrentes"),
    fila("Verse", "Lencería para dos unidades", "Comprar juegos de sábanas y toallas", "Alejandra", -1, "Limpiezas", { linea: "Verse Host" }),
    fila("Verse", "Estado de cuenta de la administración", "Responder pidiendo el estado de cuenta de noviembre", "Felipe", 0, "Verse OS", { link: "https://mail.google.com/mail/u/0/#inbox/1a2063103bb432fa" }),
    fila("Verse", "Renovación de contrato 302", "Revisar el ajuste del canon con el IPC", "Diana", 0, "Renovaciones", { linea: "Verse Living" }),
    fila("Verse", "Conciliación bancaria de octubre", "Cargar los extractos que faltan", "Felipe", 2, "Conciliación"),
    fila("Verse", "Programación de limpiezas", "Enviar la programación de la semana", "Alejandra", 3, "Limpiezas", { linea: "Verse Host" }),
    fila("Verse", "Cambio en la liquidación de la 805", "Aprobar: Subir el aseo de 60.000 a 75.000 en F_CORTAS", "Felipe", 0, "Liquidaciones", { linea: "Verse Host" }),
    fila("C&C", "Acta de corte 7", "Revisar las cantidades del contratista de mampostería", "Alejandra", 0, "Actas", { linea: "Balcony" }),
    fila("C&C", "Pago a proveedor de tubería", "Crítico: Programar el pago marcado HOY", "Felipe", -2, "Pagos de obra", { linea: "Balcony" }),
    fila("C&C", "Anticipo del contratista eléctrico", "Aprobar: Registrar un anticipo de 4.000.000", "Felipe", 1, "Contratistas", { linea: "Balcony" }),
  ]);
  await db.insert(unidades).values([
    { recId: "recVITRINAUNI0001", linea: "Host", unidad: "Torre Norte 603", edificio: "Torre Norte", estado: "Actual" },
    { recId: "recVITRINAUNI0002", linea: "Living", unidad: "Balcony 302", edificio: "Balcony", estado: "Actual" },
  ]);
  return db;
}
