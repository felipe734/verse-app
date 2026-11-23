CREATE TABLE "auditoria" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL,
	"autor" text NOT NULL,
	"accion" text NOT NULL,
	"id_base" text,
	"id_tabla" text,
	"rec_id" text,
	"antes" jsonb,
	"despues" jsonb,
	"detalle" text
);
--> statement-breakpoint
CREATE TABLE "cola_escrituras" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"id_base" text NOT NULL,
	"id_tabla" text NOT NULL,
	"rec_id" text,
	"operacion" text NOT NULL,
	"campos" jsonb NOT NULL,
	"esperado" jsonb,
	"autor" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"error" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL,
	"proximo_intento" timestamp with time zone DEFAULT now() NOT NULL,
	"procesado" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reconciliaciones" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"clave" text NOT NULL,
	"cuando" timestamp with time zone DEFAULT now() NOT NULL,
	"filas_airtable" integer NOT NULL,
	"filas_copia" integer NOT NULL,
	"faltaban" integer NOT NULL,
	"sobraban" integer NOT NULL,
	"distintas" integer NOT NULL,
	"cuadra" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registros" (
	"id_base" text NOT NULL,
	"id_tabla" text NOT NULL,
	"rec_id" text NOT NULL,
	"campos" jsonb NOT NULL,
	"huella" text NOT NULL,
	"creado_en_airtable" timestamp with time zone NOT NULL,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registros_id_base_id_tabla_rec_id_pk" PRIMARY KEY("id_base","id_tabla","rec_id")
);
--> statement-breakpoint
CREATE TABLE "sync_estado" (
	"clave" text PRIMARY KEY NOT NULL,
	"id_base" text NOT NULL,
	"id_tabla" text NOT NULL,
	"filas" integer DEFAULT 0 NOT NULL,
	"ultima_carga" timestamp with time zone,
	"ultima_reconciliacion" timestamp with time zone,
	"webhook_id" text,
	"webhook_mac" text,
	"webhook_cursor" integer DEFAULT 1 NOT NULL,
	"webhook_vence" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "tareas" (
	"rec_id" text PRIMARY KEY NOT NULL,
	"empresa" text NOT NULL,
	"numero" integer,
	"tipo" text,
	"asunto" text,
	"proceso" text,
	"estado" text,
	"responsable" text,
	"fecha_limite" date,
	"detalle" text,
	"link" text,
	"corrida" text[] DEFAULT '{}'::text[] NOT NULL,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unidades" (
	"rec_id" text PRIMARY KEY NOT NULL,
	"linea" text NOT NULL,
	"unidad" text,
	"edificio" text,
	"estado" text,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auditoria_registro" ON "auditoria" USING btree ("id_tabla","rec_id");--> statement-breakpoint
CREATE INDEX "cola_pendientes" ON "cola_escrituras" USING btree ("estado","proximo_intento");--> statement-breakpoint
CREATE INDEX "tareas_empresa_estado" ON "tareas" USING btree ("empresa","estado");