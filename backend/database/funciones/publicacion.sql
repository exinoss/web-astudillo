-- Encola el contenido congelado. Si ya hay una en cola, la reemplaza: se compila una sola vez.
-- Idempotente: si ya hay una publicación en cola o compilándose con este mismo contenido, la
-- devuelve en vez de crear otra (doble clic, dos personas a la vez). Si hay una en cola con
-- contenido distinto, la reemplaza: no tiene sentido compilar dos veces seguidas.
DROP FUNCTION IF EXISTS fn_publication_create(integer, jsonb);
CREATE OR REPLACE FUNCTION fn_publication_create(p_actor integer, p_content jsonb)
RETURNS TABLE(id_publicacion integer, estado varchar) LANGUAGE plpgsql AS $$
DECLARE v_id integer; v_state varchar;
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.publicar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:publicacion'));
  SELECT p.id_publicacion, p.estado INTO v_id, v_state FROM tb_publicaciones p
  WHERE p.estado IN ('en_cola', 'publicando') AND p.contenido = p_content
  ORDER BY p.id_publicacion DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN QUERY SELECT v_id, v_state; RETURN; END IF;
  UPDATE tb_publicaciones p SET contenido = p_content, creado_por = p_actor, creado_en = now()
  WHERE p.estado = 'en_cola' RETURNING p.id_publicacion INTO v_id;
  IF v_id IS NULL THEN
    INSERT INTO tb_publicaciones (contenido, creado_por) VALUES (p_content, p_actor)
    RETURNING tb_publicaciones.id_publicacion INTO v_id;
  END IF;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro)
  VALUES (p_actor, 'publicacion_solicitada', 'tb_publicaciones', v_id);
  RETURN QUERY SELECT v_id, 'en_cola'::varchar;
END;
$$;

-- Historial paginado; siempre devuelve una fila con el total aunque la página quede vacía.
CREATE OR REPLACE FUNCTION fn_publications_list(p_limit integer, p_offset integer)
RETURNS TABLE(id_publicacion integer, estado varchar, creado_en timestamptz, iniciado_en timestamptz,
  terminado_en timestamptz, detalle text, autor varchar, total bigint)
LANGUAGE sql STABLE AS $$
  SELECT pagina.id_publicacion, pagina.estado, pagina.creado_en, pagina.iniciado_en,
    pagina.terminado_en, pagina.detalle, pagina.autor, conteo.total
  FROM (SELECT count(*) AS total FROM tb_publicaciones) conteo
  LEFT JOIN LATERAL (
    SELECT p.id_publicacion, p.estado, p.creado_en, p.iniciado_en, p.terminado_en, p.detalle,
      u.nombres_completos AS autor
    FROM tb_publicaciones p LEFT JOIN tb_usuarios u ON u.id_usuario = p.creado_por
    ORDER BY p.id_publicacion DESC LIMIT p_limit OFFSET p_offset
  ) pagina ON true;
$$;

-- Última publicación que no falló (en cola, compilándose o publicada): contra ella se calcula
-- lo pendiente, así lo que ya se envió a publicar deja de contar como cambio.
DROP FUNCTION IF EXISTS fn_publication_last_published();
CREATE OR REPLACE FUNCTION fn_publication_latest()
RETURNS TABLE(id_publicacion integer, estado varchar, contenido jsonb) LANGUAGE sql STABLE AS $$
  SELECT p.id_publicacion, p.estado, p.contenido FROM tb_publicaciones p WHERE p.estado <> 'fallida'
  ORDER BY p.id_publicacion DESC LIMIT 1;
$$;

-- Contenido que lee el frontend al compilar: el que se está compilando o, si no hay, el último publicado.
-- Nunca devuelve borradores ni publicaciones en cola o fallidas.
CREATE OR REPLACE FUNCTION fn_publication_current()
RETURNS TABLE(contenido jsonb) LANGUAGE sql STABLE AS $$
  SELECT p.contenido FROM tb_publicaciones p WHERE p.estado IN ('publicando', 'publicada')
  ORDER BY p.id_publicacion DESC LIMIT 1;
$$;

-- El publicador toma la publicación en cola; SKIP LOCKED evita que dos procesos compilen la misma.
CREATE OR REPLACE FUNCTION fn_publication_claim()
RETURNS TABLE(id_publicacion integer, contenido jsonb) LANGUAGE sql AS $$
  UPDATE tb_publicaciones p SET estado = 'publicando', iniciado_en = now()
  WHERE p.id_publicacion = (
    SELECT q.id_publicacion FROM tb_publicaciones q WHERE q.estado = 'en_cola'
    ORDER BY q.id_publicacion LIMIT 1 FOR UPDATE SKIP LOCKED
  )
  RETURNING p.id_publicacion, p.contenido;
$$;

-- Cierra una publicación como publicada o fallida, con las últimas líneas del registro.
CREATE OR REPLACE FUNCTION fn_publication_finish(p_id integer, p_ok boolean, p_detail text)
RETURNS void LANGUAGE sql AS $$
  UPDATE tb_publicaciones SET estado = CASE WHEN p_ok THEN 'publicada' ELSE 'fallida' END,
    terminado_en = now(), detalle = p_detail
  WHERE id_publicacion = p_id AND estado = 'publicando';
$$;

-- Si el publicador se reinició a mitad de una compilación, la marca como fallida al arrancar.
CREATE OR REPLACE FUNCTION fn_publication_recover()
RETURNS void LANGUAGE sql AS $$
  UPDATE tb_publicaciones SET estado = 'fallida', terminado_en = now(),
    detalle = 'Interrumpida: el publicador se reinició durante la compilación'
  WHERE estado = 'publicando';
$$;

-- Idempotente: con el mismo contenido en cola, compilándose o listo devuelve ese estado sin
-- compilar otra vez. Con contenido distinto la deja en cola; si había una compilando, al terminar
-- fn_preview_finish no la da por lista porque el estado ya no es 'compilando'.
CREATE OR REPLACE FUNCTION fn_preview_request(p_actor integer, p_content jsonb)
RETURNS TABLE(estado varchar) LANGUAGE plpgsql AS $$
DECLARE v_state varchar;
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:vista-previa'));
  SELECT v.estado INTO v_state FROM tb_vista_previa v
  WHERE v.id = 1 AND v.contenido = p_content AND v.estado IN ('en_cola', 'compilando', 'lista');
  IF v_state IS NOT NULL THEN RETURN QUERY SELECT v_state; RETURN; END IF;
  INSERT INTO tb_vista_previa AS v (id, estado, contenido, solicitado_por)
  VALUES (1, 'en_cola', p_content, p_actor)
  ON CONFLICT (id) DO UPDATE SET estado = 'en_cola', contenido = EXCLUDED.contenido,
    solicitado_por = EXCLUDED.solicitado_por, solicitado_en = now(), terminado_en = NULL, detalle = NULL;
  RETURN QUERY SELECT 'en_cola'::varchar;
END;
$$;

CREATE OR REPLACE FUNCTION fn_preview_state()
RETURNS TABLE(estado varchar) LANGUAGE sql STABLE AS $$
  SELECT v.estado FROM tb_vista_previa v WHERE v.id = 1;
$$;

CREATE OR REPLACE FUNCTION fn_preview_claim()
RETURNS TABLE(contenido jsonb) LANGUAGE sql AS $$
  UPDATE tb_vista_previa v SET estado = 'compilando' WHERE v.id = 1 AND v.estado = 'en_cola'
  RETURNING v.contenido;
$$;

CREATE OR REPLACE FUNCTION fn_preview_finish(p_ok boolean, p_detail text)
RETURNS void LANGUAGE sql AS $$
  UPDATE tb_vista_previa SET estado = CASE WHEN p_ok THEN 'lista' ELSE 'fallida' END,
    terminado_en = now(), detalle = p_detail
  WHERE id = 1 AND estado = 'compilando';
$$;

-- Al arrancar el publicador (también tras desplegar código nuevo) la vista previa se vuelve a compilar.
CREATE OR REPLACE FUNCTION fn_preview_recover()
RETURNS void LANGUAGE sql AS $$
  UPDATE tb_vista_previa SET estado = 'en_cola', terminado_en = NULL, detalle = NULL
  WHERE id = 1 AND estado IN ('compilando', 'lista');
$$;
