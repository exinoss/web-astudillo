ALTER TABLE "tb_token_autenticacion" DROP CONSTRAINT "tb_token_autenticacion_proposito_check";--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" DROP CONSTRAINT "ck_token_destino";--> statement-breakpoint
-- Google ya no confirma por correo (solo se entra con Gmail o Google Workspace): se descartan sus enlaces pendientes.
DELETE FROM "tb_token_autenticacion" WHERE "proposito" IN ('registro_google', 'vincular_google');--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" DROP COLUMN "sujeto_externo";--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" DROP COLUMN "verificador_navegador_hash";--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" ADD CONSTRAINT "tb_token_autenticacion_proposito_check" CHECK ((proposito)::text = ANY ((ARRAY['registro_correo'::character varying, 'recuperar_contrasenia'::character varying, 'acceso_correo'::character varying])::text[]));--> statement-breakpoint
ALTER TABLE "tb_token_autenticacion" ADD CONSTRAINT "ck_token_destino" CHECK ((((proposito)::text = 'registro_correo'::text) AND (id_usuario IS NULL)) OR (((proposito)::text = ANY ((ARRAY['recuperar_contrasenia'::character varying, 'acceso_correo'::character varying])::text[])) AND (id_usuario IS NOT NULL)));