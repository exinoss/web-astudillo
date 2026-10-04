-- Privilegios de los usuarios de producción que crea server-produccion/postgres/roles.sh.
-- En local y en pruebas esos usuarios no existen y solo se aplica el REVOKE (el dueño conserva todo).
-- Las funciones son SECURITY INVOKER: quien las llama necesita además permiso sobre sus tablas.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astudillo_app') THEN
    GRANT USAGE ON SCHEMA public, drizzle TO astudillo_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO astudillo_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO astudillo_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO astudillo_app;
    -- assertMigrated comprueba al arrancar que no falten migraciones.
    GRANT SELECT ON drizzle.__drizzle_migrations TO astudillo_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astudillo_pub') THEN
    GRANT USAGE ON SCHEMA public TO astudillo_pub;
    GRANT SELECT, UPDATE (estado, iniciado_en, terminado_en, detalle) ON tb_publicaciones TO astudillo_pub;
    GRANT EXECUTE ON FUNCTION fn_publication_claim(), fn_publication_finish(integer, boolean, text),
      fn_publication_recover() TO astudillo_pub;
  END IF;

  -- Consultas y copias (pg_dump) de solo lectura; no lo crea roles.sh, se crea a mano.
  -- pg_dump necesita además el esquema drizzle y leer las secuencias.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'astudillo_lectura') THEN
    GRANT USAGE ON SCHEMA public, drizzle TO astudillo_lectura;
    GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO astudillo_lectura;
    GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO astudillo_lectura;
  END IF;
END $$;
