CREATE TABLE "tb_auditoria" (
	"id_auditoria" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_auditoria_id_auditoria_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_actor" integer,
	"accion" varchar(80) NOT NULL,
	"entidad" varchar(80) NOT NULL,
	"id_registro" integer,
	"cambios" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "tb_auditoria_cambios_check" CHECK (jsonb_typeof(cambios) = 'object'::text)
);
--> statement-breakpoint
CREATE TABLE "tb_identidades_autenticacion" (
	"id_identidad" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_identidades_autenticacion_id_identidad_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_usuario" integer NOT NULL,
	"proveedor" varchar(20) NOT NULL,
	"sujeto_externo" varchar(255),
	"contrasenia_hash" text,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "uq_identidad_usuario_proveedor" UNIQUE("id_usuario","proveedor"),
	CONSTRAINT "uq_identidad_proveedor_sujeto" UNIQUE("proveedor","sujeto_externo"),
	CONSTRAINT "tb_identidades_autenticacion_proveedor_check" CHECK ((proveedor)::text = ANY ((ARRAY['correo'::character varying, 'google'::character varying])::text[])),
	CONSTRAINT "ck_identidad_credenciales" CHECK ((((proveedor)::text = 'correo'::text) AND (sujeto_externo IS NULL) AND (contrasenia_hash IS NOT NULL) AND (contrasenia_hash <> ''::text)) OR (((proveedor)::text = 'google'::text) AND (sujeto_externo IS NOT NULL) AND ((sujeto_externo)::text <> ''::text) AND (contrasenia_hash IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "tb_permisos" (
	"id_permiso" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_permisos_id_permiso_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"codigo" varchar(80) NOT NULL,
	"descripcion" text,
	CONSTRAINT "tb_permisos_codigo_key" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "tb_registros_pendientes" (
	"id_token_autenticacion" integer PRIMARY KEY NOT NULL,
	"nombres_completos" varchar(200) NOT NULL,
	"direccion" text,
	"contrasenia_hash" text NOT NULL,
	"verificador_navegador_hash" text NOT NULL,
	CONSTRAINT "tb_registros_pendientes_nombres_completos_check" CHECK (btrim((nombres_completos)::text) <> ''::text),
	CONSTRAINT "tb_registros_pendientes_contrasenia_hash_check" CHECK (contrasenia_hash <> ''::text),
	CONSTRAINT "tb_registros_pendientes_verificador_navegador_hash_check" CHECK (verificador_navegador_hash <> ''::text)
);
--> statement-breakpoint
CREATE TABLE "tb_rol_permisos" (
	"id_rol" integer NOT NULL,
	"id_permiso" integer NOT NULL,
	CONSTRAINT "tb_rol_permisos_pkey" PRIMARY KEY("id_rol","id_permiso")
);
--> statement-breakpoint
CREATE TABLE "tb_roles" (
	"id_rol" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_roles_id_rol_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rol" varchar(40) NOT NULL,
	"nombre" varchar(40) NOT NULL,
	"descripcion" text,
	CONSTRAINT "tb_roles_rol_key" UNIQUE("rol")
);
--> statement-breakpoint
CREATE TABLE "tb_sesiones" (
	"id_sesion" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_sesiones_id_sesion_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_usuario" integer NOT NULL,
	"token_hash" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"revocado_en" timestamp with time zone,
	"ultimo_uso_en" timestamp with time zone,
	CONSTRAINT "tb_sesiones_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "tb_sesiones_token_hash_check" CHECK (token_hash <> ''::text),
	CONSTRAINT "ck_sesion_vigencia" CHECK (expira_en > creado_en)
);
--> statement-breakpoint
CREATE TABLE "tb_token_autenticacion" (
	"id_token_autenticacion" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_token_autenticacion_id_token_autenticacion_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id_usuario" integer,
	"correo" varchar(320) NOT NULL,
	"proposito" varchar(30) NOT NULL,
	"sujeto_externo" varchar(255),
	"verificador_navegador_hash" text,
	"token_hash" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"consumido_en" timestamp with time zone,
	CONSTRAINT "tb_token_autenticacion_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "tb_token_autenticacion_proposito_check" CHECK ((proposito)::text = ANY ((ARRAY['registro_correo'::character varying, 'registro_google'::character varying, 'vincular_google'::character varying, 'recuperar_contrasenia'::character varying])::text[])),
	CONSTRAINT "tb_token_autenticacion_token_hash_check" CHECK (token_hash <> ''::text),
	CONSTRAINT "ck_token_correo_limpio" CHECK (((correo)::text = btrim((correo)::text)) AND ((correo)::text <> ''::text)),
	CONSTRAINT "ck_token_vigencia" CHECK (expira_en > creado_en),
	CONSTRAINT "ck_token_destino" CHECK ((((proposito)::text = 'registro_correo'::text) AND (id_usuario IS NULL) AND (sujeto_externo IS NULL)) OR (((proposito)::text = 'registro_google'::text) AND (id_usuario IS NULL) AND (sujeto_externo IS NOT NULL) AND ((sujeto_externo)::text <> ''::text)) OR (((proposito)::text = 'vincular_google'::text) AND (id_usuario IS NOT NULL) AND (sujeto_externo IS NOT NULL) AND ((sujeto_externo)::text <> ''::text)) OR (((proposito)::text = 'recuperar_contrasenia'::text) AND (id_usuario IS NOT NULL) AND (sujeto_externo IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "tb_usuarios" (
	"id_usuario" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tb_usuarios_id_usuario_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"correo" varchar(320) NOT NULL,
	"nombres_completos" varchar(200),
	"direccion" text,
	"correo_verificado_en" timestamp with time zone NOT NULL,
	"rol" varchar(40) DEFAULT 'votante' NOT NULL,
	"estado" varchar(20) DEFAULT 'activo' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "tb_usuarios_estado_check" CHECK ((estado)::text = ANY ((ARRAY['activo'::character varying, 'bloqueado'::character varying])::text[])),
	CONSTRAINT "ck_usuarios_correo_limpio" CHECK (((correo)::text = btrim((correo)::text)) AND ((correo)::text <> ''::text))
);
--> statement-breakpoint
ALTER TABLE "tb_auditoria" ADD CONSTRAINT "tb_auditoria_id_actor_fkey" FOREIGN KEY ("id_actor") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_identidades_autenticacion" ADD CONSTRAINT "tb_identidades_autenticacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_registros_pendientes" ADD CONSTRAINT "tb_registros_pendientes_id_token_autenticacion_fkey" FOREIGN KEY ("id_token_autenticacion") REFERENCES "public"."tb_token_autenticacion"("id_token_autenticacion") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_rol_permisos" ADD CONSTRAINT "tb_rol_permisos_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "public"."tb_roles"("id_rol") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_rol_permisos" ADD CONSTRAINT "tb_rol_permisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "public"."tb_permisos"("id_permiso") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_sesiones" ADD CONSTRAINT "tb_sesiones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" ADD CONSTRAINT "tb_token_autenticacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_usuarios" ADD CONSTRAINT "tb_usuarios_rol_fkey" FOREIGN KEY ("rol") REFERENCES "public"."tb_roles"("rol") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "idx_auditoria_actor" ON "tb_auditoria" USING btree ("id_actor" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_auditoria_entidad_registro" ON "tb_auditoria" USING btree ("entidad","id_registro" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_rol_permisos_permiso" ON "tb_rol_permisos" USING btree ("id_permiso" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_sesiones_caducidad" ON "tb_sesiones" USING btree ("expira_en" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_sesiones_usuario" ON "tb_sesiones" USING btree ("id_usuario" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_tokens_caducidad" ON "tb_token_autenticacion" USING btree ("expira_en" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_tokens_usuario" ON "tb_token_autenticacion" USING btree ("id_usuario" int4_ops) WHERE (id_usuario IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usuarios_correo_sin_mayusculas" ON "tb_usuarios" USING btree (lower((correo)::text));