-- El día se cuenta en la hora de Ecuador: a medianoche del servidor (UTC) aún es el día anterior.
CREATE OR REPLACE FUNCTION fn_visit_add()
RETURNS void LANGUAGE sql AS $$
  INSERT INTO tb_visitas_dia AS v (dia, total) VALUES ((now() AT TIME ZONE 'America/Guayaquil')::date, 1)
  ON CONFLICT (dia) DO UPDATE SET total = v.total + 1;
$$;

-- Cifras de la portada: visitas, voces (alertas, sugerencias y chat) y votantes activos, sin contar al equipo del panel.
DROP FUNCTION IF EXISTS fn_site_stats();
CREATE OR REPLACE FUNCTION fn_site_stats()
RETURNS TABLE(visitas bigint, voces bigint, personas bigint) LANGUAGE sql STABLE AS $$
  SELECT (SELECT COALESCE(sum(total), 0) FROM tb_visitas_dia),
    (SELECT count(*) FROM tb_alertas) + (SELECT count(*) FROM tb_sugerencias) + (SELECT count(*) FROM tb_chat_envios),
    (SELECT count(*) FROM tb_usuarios WHERE rol = 'votante' AND estado = 'activo');
$$;
