-- Anota la actividad de un navegador y suma una visita si llevaba 30 minutos sin actividad (o es nuevo).
DROP FUNCTION IF EXISTS fn_visit_add();
CREATE OR REPLACE FUNCTION fn_visit_register(p_visitor text, p_count boolean)
RETURNS TABLE(nueva boolean) LANGUAGE plpgsql AS $$
DECLARE v_last timestamptz;
BEGIN
  -- Dos pestañas o un reintento a la vez: la segunda espera y ve la actividad de la primera.
  PERFORM pg_advisory_xact_lock(hashtextextended('visita:' || p_visitor, 0));
  SELECT ultima_actividad INTO v_last FROM tb_visitantes_activos WHERE visitante = p_visitor;
  nueva := p_count AND (v_last IS NULL OR v_last <= now() - interval '30 minutes');
  INSERT INTO tb_visitantes_activos (visitante, ultima_actividad) VALUES (p_visitor, now())
  ON CONFLICT (visitante) DO UPDATE SET ultima_actividad = now();
  -- El día se cuenta en la hora de Ecuador: a medianoche del servidor (UTC) aún es el día anterior.
  IF nueva THEN
    INSERT INTO tb_visitas_dia AS v (dia, total) VALUES ((now() AT TIME ZONE 'America/Guayaquil')::date, 1)
    ON CONFLICT (dia) DO UPDATE SET total = v.total + 1;
  END IF;
  DELETE FROM tb_visitantes_activos WHERE ultima_actividad < now() - interval '30 minutes';
  RETURN NEXT;
END;
$$;

-- Cifras de la portada: visitas, voces (alertas, sugerencias y chat) y votantes activos, sin contar al equipo del panel.
DROP FUNCTION IF EXISTS fn_site_stats();
CREATE OR REPLACE FUNCTION fn_site_stats()
RETURNS TABLE(visitas bigint, voces bigint, personas bigint) LANGUAGE sql STABLE AS $$
  SELECT (SELECT COALESCE(sum(total), 0) FROM tb_visitas_dia),
    (SELECT count(*) FROM tb_alertas WHERE borrada_en IS NULL)
      + (SELECT count(*) FROM tb_sugerencias WHERE borrada_en IS NULL) + (SELECT count(*) FROM tb_chat_envios),
    (SELECT count(*) FROM tb_usuarios WHERE rol = 'votante' AND estado = 'activo');
$$;
