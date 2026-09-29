CREATE TABLE "tb_biografia_hitos" (
	"id_hito" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_biografia_hitos_id_hito_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orden" integer NOT NULL,
	"anios" varchar(40) NOT NULL,
	"titulo" varchar(120) NOT NULL,
	"texto" varchar(3000) NOT NULL,
	"id_medio" integer,
	"alt" varchar(200)
);
--> statement-breakpoint
CREATE TABLE "tb_medios" (
	"id_medio" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_medios_id_medio_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" varchar(80) NOT NULL,
	"ancho" integer NOT NULL,
	"alto" integer NOT NULL,
	"anchos" integer[] NOT NULL,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "uq_medios_nombre" UNIQUE("nombre"),
	CONSTRAINT "ck_medios_nombre" CHECK (nombre ~ '^[a-z0-9-]{8,80}$')
);
--> statement-breakpoint
CREATE TABLE "tb_obra_fotos" (
	"id_foto" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_obra_fotos_id_foto_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(80) NOT NULL,
	"orden" integer NOT NULL,
	"id_medio" integer NOT NULL,
	"pie" varchar(200) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tb_obra_hitos" (
	"id_hito" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_obra_hitos_id_hito_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(80) NOT NULL,
	"orden" integer NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"completado" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tb_obras" (
	"slug" varchar(80) PRIMARY KEY NOT NULL,
	"nota" varchar(600) NOT NULL,
	"actualizado_por" integer,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tb_propuesta_kpis" (
	"id_kpi" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_propuesta_kpis_id_kpi_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(80) NOT NULL,
	"orden" integer NOT NULL,
	"etiqueta" varchar(60) NOT NULL,
	"valor" varchar(30) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tb_propuestas" (
	"slug" varchar(80) PRIMARY KEY NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"categoria" varchar(80) NOT NULL,
	"introduccion" varchar(400) NOT NULL,
	"orden" integer NOT NULL,
	"actualizado_por" integer,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tb_publicaciones" (
	"id_publicacion" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_publicaciones_id_publicacion_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"estado" varchar(20) DEFAULT 'en_cola' NOT NULL,
	"contenido" jsonb NOT NULL,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"iniciado_en" timestamp with time zone,
	"terminado_en" timestamp with time zone,
	"detalle" text,
	CONSTRAINT "ck_publicaciones_estado" CHECK (estado IN ('en_cola', 'publicando', 'publicada', 'fallida')),
	CONSTRAINT "ck_publicaciones_contenido" CHECK (jsonb_typeof(contenido) = 'object')
);
--> statement-breakpoint
CREATE TABLE "tb_textos" (
	"clave" varchar(120) PRIMARY KEY NOT NULL,
	"valor" text NOT NULL,
	"actualizado_por" integer,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ck_textos_clave" CHECK (clave ~ '^[a-z0-9]+([.-][a-z0-9]+)*$'),
	CONSTRAINT "ck_textos_valor" CHECK (char_length(valor) BETWEEN 1 AND 1000)
);
--> statement-breakpoint
ALTER TABLE "tb_biografia_hitos" ADD CONSTRAINT "tb_biografia_hitos_id_medio_fkey" FOREIGN KEY ("id_medio") REFERENCES "public"."tb_medios"("id_medio") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_medios" ADD CONSTRAINT "tb_medios_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_obra_fotos" ADD CONSTRAINT "tb_obra_fotos_slug_fkey" FOREIGN KEY ("slug") REFERENCES "public"."tb_obras"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_obra_fotos" ADD CONSTRAINT "tb_obra_fotos_id_medio_fkey" FOREIGN KEY ("id_medio") REFERENCES "public"."tb_medios"("id_medio") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_obra_hitos" ADD CONSTRAINT "tb_obra_hitos_slug_fkey" FOREIGN KEY ("slug") REFERENCES "public"."tb_obras"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_obras" ADD CONSTRAINT "tb_obras_slug_fkey" FOREIGN KEY ("slug") REFERENCES "public"."tb_propuestas"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_obras" ADD CONSTRAINT "tb_obras_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_propuesta_kpis" ADD CONSTRAINT "tb_propuesta_kpis_slug_fkey" FOREIGN KEY ("slug") REFERENCES "public"."tb_propuestas"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_propuestas" ADD CONSTRAINT "tb_propuestas_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_publicaciones" ADD CONSTRAINT "tb_publicaciones_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_textos" ADD CONSTRAINT "tb_textos_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_obra_fotos_slug" ON "tb_obra_fotos" USING btree ("slug","orden");--> statement-breakpoint
CREATE INDEX "idx_obra_hitos_slug" ON "tb_obra_hitos" USING btree ("slug","orden");--> statement-breakpoint
CREATE INDEX "idx_propuesta_kpis_slug" ON "tb_propuesta_kpis" USING btree ("slug","orden");--> statement-breakpoint
CREATE INDEX "idx_publicaciones_estado" ON "tb_publicaciones" USING btree ("estado","id_publicacion");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_publicaciones_una_en_cola" ON "tb_publicaciones" USING btree ("estado") WHERE estado = 'en_cola';