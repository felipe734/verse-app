CREATE TABLE "vistas_guardadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"modulo" text NOT NULL,
	"nombre" text NOT NULL,
	"parametros" jsonb NOT NULL,
	"creado" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vistas_guardadas" ADD CONSTRAINT "vistas_guardadas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vistas_guardadas_usuario_modulo_nombre" ON "vistas_guardadas" USING btree ("usuario_id","modulo","nombre");