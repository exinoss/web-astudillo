CREATE TABLE "tb_alertas" (
	"id_alerta" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_alertas_id_alerta_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_usuario" integer NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"sector" varchar(120) NOT NULL,
	"referencia" varchar(180),
	"descripcion" varchar(1500) NOT NULL,
	"foto" varchar(80),
	"estado" varchar(20) DEFAULT 'recibida' NOT NULL,
	"clave_idempotencia" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actualizado_por" integer,
	CONSTRAINT "uq_alertas_idempotencia" UNIQUE("id_usuario","clave_idempotencia"),
	CONSTRAINT "ck_alertas_tipo" CHECK (tipo IN ('agua', 'basura', 'alumbrado', 'baches', 'seguridad', 'otro')),
	CONSTRAINT "ck_alertas_estado" CHECK (estado IN ('recibida', 'en_revision', 'atendida')),
	CONSTRAINT "ck_alertas_descripcion" CHECK (char_length(descripcion) >= 10),
	CONSTRAINT "ck_alertas_foto" CHECK (foto IS NULL OR foto ~ '^[a-z0-9-]{8,80}$')
);
--> statement-breakpoint
CREATE TABLE "tb_chat_respuestas" (
	"id_respuesta" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_chat_respuestas_id_respuesta_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orden" integer NOT NULL,
	"pregunta" varchar(160) NOT NULL,
	"palabras_clave" varchar(300) NOT NULL,
	"respuesta" varchar(1000) NOT NULL,
	"enlace_texto" varchar(60),
	"enlace_ruta" varchar(200),
	"destacada" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ck_chat_enlace_ruta" CHECK (enlace_ruta IS NULL OR enlace_ruta ~ '^/[a-z0-9/#-]*$')
);
--> statement-breakpoint
CREATE TABLE "tb_chat_sin_respuesta" (
	"texto_normalizado" varchar(300) PRIMARY KEY NOT NULL,
	"ejemplo" varchar(300) NOT NULL,
	"veces" integer DEFAULT 1 NOT NULL,
	"ultima_vez" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tb_sugerencias" (
	"id_sugerencia" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_sugerencias_id_sugerencia_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_usuario" integer NOT NULL,
	"tema" varchar(80) NOT NULL,
	"mensaje" varchar(1500) NOT NULL,
	"estado" varchar(20) DEFAULT 'recibida' NOT NULL,
	"clave_idempotencia" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actualizado_por" integer,
	CONSTRAINT "uq_sugerencias_idempotencia" UNIQUE("id_usuario","clave_idempotencia"),
	CONSTRAINT "ck_sugerencias_tema" CHECK (tema ~ '^[a-z0-9-]{1,80}$'),
	CONSTRAINT "ck_sugerencias_estado" CHECK (estado IN ('recibida', 'en_revision', 'atendida')),
	CONSTRAINT "ck_sugerencias_mensaje" CHECK (char_length(mensaje) >= 15)
);
--> statement-breakpoint
ALTER TABLE "tb_alertas" ADD CONSTRAINT "tb_alertas_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_alertas" ADD CONSTRAINT "tb_alertas_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_sugerencias" ADD CONSTRAINT "tb_sugerencias_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_sugerencias" ADD CONSTRAINT "tb_sugerencias_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alertas_usuario" ON "tb_alertas" USING btree ("id_usuario","id_alerta");--> statement-breakpoint
CREATE INDEX "idx_alertas_estado" ON "tb_alertas" USING btree ("estado","id_alerta");--> statement-breakpoint
CREATE INDEX "idx_chat_sin_respuesta_veces" ON "tb_chat_sin_respuesta" USING btree ("veces");--> statement-breakpoint
CREATE INDEX "idx_sugerencias_usuario" ON "tb_sugerencias" USING btree ("id_usuario","id_sugerencia");--> statement-breakpoint
CREATE INDEX "idx_sugerencias_estado" ON "tb_sugerencias" USING btree ("estado","id_sugerencia");