ALTER TABLE "tb_alertas" ADD COLUMN "publica" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tb_alertas" ADD COLUMN "anonima" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tb_alertas" ADD COLUMN "borrada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tb_alertas" ADD COLUMN "borrada_por" integer;--> statement-breakpoint
ALTER TABLE "tb_sugerencias" ADD COLUMN "anonima" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tb_sugerencias" ADD COLUMN "borrada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tb_sugerencias" ADD COLUMN "borrada_por" integer;--> statement-breakpoint
ALTER TABLE "tb_alertas" ADD CONSTRAINT "tb_alertas_borrada_por_fkey" FOREIGN KEY ("borrada_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tb_sugerencias" ADD CONSTRAINT "tb_sugerencias_borrada_por_fkey" FOREIGN KEY ("borrada_por") REFERENCES "public"."tb_usuarios"("id_usuario") ON DELETE set null ON UPDATE no action;