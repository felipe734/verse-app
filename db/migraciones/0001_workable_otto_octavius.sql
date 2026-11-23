CREATE TABLE "costos_neon" (
	"dia" date PRIMARY KEY NOT NULL,
	"periodo_inicio" timestamp with time zone,
	"horas_computo" double precision NOT NULL,
	"gb_almacenamiento" double precision NOT NULL,
	"usd_computo" double precision NOT NULL,
	"usd_almacenamiento" double precision NOT NULL,
	"usd_total" double precision NOT NULL,
	"tomado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llamadas_airtable" (
	"dia" date NOT NULL,
	"workspace" text NOT NULL,
	"id_base" text NOT NULL,
	"llamadas" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "llamadas_airtable_dia_workspace_id_base_pk" PRIMARY KEY("dia","workspace","id_base")
);
