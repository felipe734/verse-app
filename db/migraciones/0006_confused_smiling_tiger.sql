CREATE TABLE "avisos" (
	"clave" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"rec_id" text,
	"destinatarios" integer DEFAULT 0 NOT NULL,
	"enviados" integer DEFAULT 0 NOT NULL,
	"sembrado" boolean DEFAULT false NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suscripciones_push" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_envio" timestamp with time zone,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suscripciones_push" ADD CONSTRAINT "suscripciones_push_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "suscripciones_endpoint" ON "suscripciones_push" USING btree ("endpoint");