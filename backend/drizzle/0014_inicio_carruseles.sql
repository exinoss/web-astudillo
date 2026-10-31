CREATE TABLE "tb_inicio_carruseles" (
	"clave" varchar(20) PRIMARY KEY NOT NULL,
	"contenido" jsonb NOT NULL,
	"actualizado_por" integer,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ck_inicio_carruseles_clave" CHECK (clave IN ('principal', 'piezas')),
	CONSTRAINT "ck_inicio_carruseles_contenido" CHECK (jsonb_typeof(contenido) = 'object')
);
--> statement-breakpoint
ALTER TABLE "tb_inicio_carruseles" ADD CONSTRAINT "tb_inicio_carruseles_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;