CREATE TABLE "tb_textos_iniciales" (
	"clave" varchar(120) PRIMARY KEY NOT NULL,
	"valor" text NOT NULL,
	CONSTRAINT "ck_textos_iniciales_clave" CHECK (clave ~ '^[a-z0-9]+([.-][a-z0-9]+)*$'),
	CONSTRAINT "ck_textos_iniciales_valor" CHECK (char_length(valor) BETWEEN 1 AND 1000)
);
