CREATE TABLE "uso_pantallas" (
	"usuario_id" uuid NOT NULL,
	"ruta" text NOT NULL,
	"dia" date NOT NULL,
	"vistas" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uso_pantallas_usuario_id_ruta_dia_pk" PRIMARY KEY("usuario_id","ruta","dia")
);
--> statement-breakpoint
ALTER TABLE "uso_pantallas" ADD CONSTRAINT "uso_pantallas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;