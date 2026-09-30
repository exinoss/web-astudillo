CREATE TABLE "tb_limites_intentos" (
	"clave" varchar(400) PRIMARY KEY NOT NULL,
	"fallos" integer NOT NULL,
	"bloqueado_hasta" timestamp with time zone,
	"ultimo_fallo" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tb_registros_pendientes" DROP CONSTRAINT "tb_registros_pendientes_verificador_navegador_hash_check";--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" DROP CONSTRAINT "tb_token_autenticacion_proposito_check";--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" DROP CONSTRAINT "ck_token_destino";--> statement-breakpoint
CREATE INDEX "idx_limites_ultimo_fallo" ON "tb_limites_intentos" USING btree ("ultimo_fallo" timestamptz_ops);--> statement-breakpoint
ALTER TABLE "tb_registros_pendientes" DROP COLUMN "verificador_navegador_hash";--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" ADD CONSTRAINT "tb_token_autenticacion_proposito_check" CHECK ((proposito)::text = ANY ((ARRAY['registro_correo'::character varying, 'registro_google'::character varying, 'vincular_google'::character varying, 'recuperar_contrasenia'::character varying, 'acceso_correo'::character varying])::text[]));--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" ADD CONSTRAINT "ck_token_destino" CHECK ((((proposito)::text = 'registro_correo'::text) AND (id_usuario IS NULL) AND (sujeto_externo IS NULL)) OR (((proposito)::text = 'registro_google'::text) AND (id_usuario IS NULL) AND (sujeto_externo IS NOT NULL) AND ((sujeto_externo)::text <> ''::text)) OR (((proposito)::text = 'vincular_google'::text) AND (id_usuario IS NOT NULL) AND (sujeto_externo IS NOT NULL) AND ((sujeto_externo)::text <> ''::text)) OR (((proposito)::text = 'recuperar_contrasenia'::text) AND (id_usuario IS NOT NULL) AND (sujeto_externo IS NULL)) OR (((proposito)::text = 'acceso_correo'::text) AND (id_usuario IS NOT NULL) AND (sujeto_externo IS NULL)));