ALTER TABLE "empresas" ADD COLUMN "acento" text DEFAULT '#18181b' NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "modulos" ADD COLUMN "tipo" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "empresas" SET "acento" = '#2453d6' WHERE "id" = 'verse' AND "acento" = '#18181b';--> statement-breakpoint
UPDATE "empresas" SET "acento" = '#0f766e' WHERE "id" = 'cyc' AND "acento" = '#18181b';--> statement-breakpoint
UPDATE "modulos" SET "nombre" = 'Hoy', "descripcion" = 'Pendientes y corridas de C&C' WHERE "id" = 'cyc-hoy' AND "nombre" = 'Hoy y Para aprobar';
