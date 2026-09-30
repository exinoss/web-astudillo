ALTER TABLE "tb_medios" ADD COLUMN "hash_contenido" varchar(64);--> statement-breakpoint
ALTER TABLE "tb_sesiones" ADD COLUMN "token_hash_anterior" text;--> statement-breakpoint
ALTER TABLE "tb_sesiones" ADD COLUMN "rotado_en" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_sesiones_token_anterior" ON "tb_sesiones" USING btree ("token_hash_anterior" text_ops);--> statement-breakpoint
ALTER TABLE "tb_medios" ADD CONSTRAINT "uq_medios_hash_contenido" UNIQUE("hash_contenido");