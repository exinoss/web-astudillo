ALTER TABLE "tb_obra_fotos" ALTER COLUMN "id_medio" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tb_obra_fotos" ADD COLUMN "enlace" varchar(500);--> statement-breakpoint
ALTER TABLE "tb_obra_fotos" ADD COLUMN "vertical" boolean;--> statement-breakpoint
ALTER TABLE "tb_obra_fotos" ADD CONSTRAINT "ck_obra_fotos_tipo" CHECK ((enlace IS NULL) = (vertical IS NULL) AND (enlace IS NOT NULL OR id_medio IS NOT NULL));