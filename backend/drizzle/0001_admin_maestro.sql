ALTER TABLE "tb_usuarios" ADD COLUMN "es_maestro" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_usuarios_un_maestro" ON "tb_usuarios" USING btree ("es_maestro") WHERE es_maestro;--> statement-breakpoint
ALTER TABLE "tb_usuarios" ADD CONSTRAINT "ck_usuarios_maestro_admin" CHECK (NOT es_maestro OR (rol)::text = 'admin'::text);