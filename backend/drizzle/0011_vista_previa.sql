CREATE TABLE "tb_vista_previa" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"estado" varchar(20) NOT NULL,
	"contenido" jsonb NOT NULL,
	"solicitado_por" integer,
	"solicitado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"terminado_en" timestamp with time zone,
	"detalle" text,
	CONSTRAINT "ck_vista_previa_unica" CHECK (id = 1),
	CONSTRAINT "ck_vista_previa_estado" CHECK (estado IN ('en_cola', 'compilando', 'lista', 'fallida')),
	CONSTRAINT "ck_vista_previa_contenido" CHECK (jsonb_typeof(contenido) = 'object')
);
--> statement-breakpoint
ALTER TABLE "tb_vista_previa" ADD CONSTRAINT "tb_vista_previa_solicitado_por_fkey" FOREIGN KEY ("solicitado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;