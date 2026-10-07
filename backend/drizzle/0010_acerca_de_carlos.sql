CREATE TABLE "tb_acerca_de_carlos" (
	"slug" varchar(40) PRIMARY KEY NOT NULL,
	"contenido" jsonb NOT NULL,
	"actualizado_por" integer,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ck_acerca_de_carlos_slug" CHECK (slug IN ('por-que-quiero-ser-alcalde', 'conoce-mas')),
	CONSTRAINT "ck_acerca_de_carlos_contenido" CHECK (jsonb_typeof(contenido) = 'object')
);
--> statement-breakpoint
ALTER TABLE "tb_acerca_de_carlos" ADD CONSTRAINT "tb_acerca_de_carlos_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;