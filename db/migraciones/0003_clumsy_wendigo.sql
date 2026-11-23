CREATE TABLE "respaldo_adjuntos" (
	"id_adjunto" text PRIMARY KEY NOT NULL,
	"id_base" text NOT NULL,
	"id_tabla" text NOT NULL,
	"base" text NOT NULL,
	"tabla" text NOT NULL,
	"rec_id" text NOT NULL,
	"id_campo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text,
	"bytes" double precision,
	"url" text NOT NULL,
	"url_tomada" timestamp with time zone DEFAULT now() NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"id_drive" text,
	"error" text,
	"guardado" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "respaldos" ADD COLUMN "adjuntos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "respaldos" ADD COLUMN "bytes_adjuntos" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "adjuntos_pendientes" ON "respaldo_adjuntos" USING btree ("estado");