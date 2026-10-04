CREATE TABLE "tb_chat_envios" (
	"id_usuario" integer NOT NULL,
	"clave_idempotencia" uuid NOT NULL,
	"mensaje_hash" varchar(64) NOT NULL,
	"respuesta" jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "tb_chat_envios_id_usuario_clave_idempotencia_pk" PRIMARY KEY("id_usuario","clave_idempotencia"),
	CONSTRAINT "ck_chat_envios_hash" CHECK (mensaje_hash ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "ck_chat_envios_respuesta" CHECK (jsonb_typeof(respuesta) = 'object')
);
--> statement-breakpoint
ALTER TABLE "tb_usuarios" ADD COLUMN "version_perfil" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tb_chat_envios" ADD CONSTRAINT "tb_chat_envios_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE cascade ON UPDATE no action;