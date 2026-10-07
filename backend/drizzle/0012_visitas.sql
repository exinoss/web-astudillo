CREATE TABLE "tb_visitas_dia" (
	"dia" date PRIMARY KEY NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ck_visitas_dia_total" CHECK (total >= 0)
);
