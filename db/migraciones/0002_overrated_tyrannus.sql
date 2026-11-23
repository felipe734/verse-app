CREATE TABLE "respaldo_tareas" (
	"fecha" date NOT NULL,
	"id_base" text NOT NULL,
	"id_tabla" text NOT NULL,
	"base" text NOT NULL,
	"tabla" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"filas" integer,
	"bytes" integer,
	"error" text,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "respaldo_tareas_fecha_id_base_id_tabla_pk" PRIMARY KEY("fecha","id_base","id_tabla")
);
--> statement-breakpoint
CREATE TABLE "respaldos" (
	"fecha" date PRIMARY KEY NOT NULL,
	"estado" text DEFAULT 'en_curso' NOT NULL,
	"carpeta_id" text,
	"tablas" integer DEFAULT 0 NOT NULL,
	"hechas" integer DEFAULT 0 NOT NULL,
	"fallidas" integer DEFAULT 0 NOT NULL,
	"filas" integer DEFAULT 0 NOT NULL,
	"bytes" double precision DEFAULT 0 NOT NULL,
	"inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"fin" timestamp with time zone,
	"error" text
);
