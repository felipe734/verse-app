CREATE TABLE "conversaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensajes_asistente" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"conversacion_id" uuid NOT NULL,
	"rol" text NOT NULL,
	"contenido" jsonb NOT NULL,
	"modelo" text,
	"tokens_entrada" integer DEFAULT 0 NOT NULL,
	"tokens_salida" integer DEFAULT 0 NOT NULL,
	"tokens_cache_leidos" integer DEFAULT 0 NOT NULL,
	"tokens_cache_escritos" integer DEFAULT 0 NOT NULL,
	"costo_usd" double precision DEFAULT 0 NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propuestas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"conversacion_id" uuid,
	"tipo" text NOT NULL,
	"datos" jsonb NOT NULL,
	"resumen" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"resultado" text,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversaciones" ADD CONSTRAINT "conversaciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes_asistente" ADD CONSTRAINT "mensajes_asistente_conversacion_id_conversaciones_id_fk" FOREIGN KEY ("conversacion_id") REFERENCES "public"."conversaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propuestas" ADD CONSTRAINT "propuestas_conversacion_id_conversaciones_id_fk" FOREIGN KEY ("conversacion_id") REFERENCES "public"."conversaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mensajes_conversacion" ON "mensajes_asistente" USING btree ("conversacion_id","id");