CREATE TABLE "tb_aceptaciones_legales" (
	"id_usuario" integer NOT NULL,
	"version" varchar(32) NOT NULL,
	"texto" text NOT NULL,
	"aceptado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "tb_aceptaciones_legales_pkey" PRIMARY KEY("id_usuario","version"),
	CONSTRAINT "ck_aceptacion_version" CHECK (btrim(version) <> ''),
	CONSTRAINT "ck_aceptacion_texto" CHECK (btrim(texto) <> '')
);
--> statement-breakpoint
ALTER TABLE "tb_registros_pendientes" ADD COLUMN "version_legal" varchar(32);--> statement-breakpoint
ALTER TABLE "tb_registros_pendientes" ADD COLUMN "texto_aceptacion" text;--> statement-breakpoint
ALTER TABLE "tb_registros_pendientes" ADD COLUMN "aceptado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tb_aceptaciones_legales" ADD CONSTRAINT "tb_aceptaciones_legales_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_registros_pendientes" ADD CONSTRAINT "ck_registro_aceptacion" CHECK ((version_legal IS NULL AND texto_aceptacion IS NULL AND aceptado_en IS NULL) OR (version_legal IS NOT NULL AND btrim(version_legal) <> '' AND texto_aceptacion IS NOT NULL AND btrim(texto_aceptacion) <> '' AND aceptado_en IS NOT NULL));