CREATE TABLE "accesos" (
	"usuario_id" uuid NOT NULL,
	"empresa_id" text NOT NULL,
	"plantilla_id" text,
	"casillas" jsonb NOT NULL,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accesos_usuario_id_empresa_id_pk" PRIMARY KEY("usuario_id","empresa_id")
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"cuentas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitaciones" (
	"hash" text PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"vence" timestamp with time zone NOT NULL,
	"usada" timestamp with time zone,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modulos" (
	"id" text PRIMARY KEY NOT NULL,
	"vertical_id" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plantillas" (
	"id" text PRIMARY KEY NOT NULL,
	"empresa_id" text NOT NULL,
	"nombre" text NOT NULL,
	"casillas" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"correo" text NOT NULL,
	"celular" text,
	"estado" text DEFAULT 'invitado' NOT NULL,
	"maestro" boolean DEFAULT false NOT NULL,
	"nombre_airtable" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_ingreso" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verticales" (
	"id" text PRIMARY KEY NOT NULL,
	"empresa_id" text NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accesos" ADD CONSTRAINT "accesos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accesos" ADD CONSTRAINT "accesos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accesos" ADD CONSTRAINT "accesos_plantilla_id_plantillas_id_fk" FOREIGN KEY ("plantilla_id") REFERENCES "public"."plantillas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modulos" ADD CONSTRAINT "modulos_vertical_id_verticales_id_fk" FOREIGN KEY ("vertical_id") REFERENCES "public"."verticales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantillas" ADD CONSTRAINT "plantillas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verticales" ADD CONSTRAINT "verticales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_correo" ON "usuarios" USING btree ("correo");