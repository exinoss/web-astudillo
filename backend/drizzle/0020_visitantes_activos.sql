CREATE TABLE "tb_visitantes_activos" (
	"visitante" text PRIMARY KEY NOT NULL,
	"ultima_actividad" timestamp with time zone NOT NULL,
	CONSTRAINT "ck_visitante_huella" CHECK (visitante ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE INDEX "idx_visitantes_actividad" ON "tb_visitantes_activos" USING btree ("ultima_actividad" timestamptz_ops);