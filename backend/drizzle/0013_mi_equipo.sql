CREATE TABLE "tb_mi_equipo" (
	"clave" varchar(40) PRIMARY KEY NOT NULL,
	"contenido" jsonb NOT NULL,
	"actualizado_por" integer,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ck_mi_equipo_clave" CHECK (clave IN ('equipo', 'alto-tambo', 'ancon', 'calderon', 'carondelet', '5-de-junio', 'concepcion', 'mataje', 'san-javier-de-cachavi', 'santa-rita', 'tambillo', 'tululbi', 'urbina')),
	CONSTRAINT "ck_mi_equipo_contenido" CHECK (jsonb_typeof(contenido) = 'object')
);
--> statement-breakpoint
ALTER TABLE "tb_mi_equipo" ADD CONSTRAINT "tb_mi_equipo_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;