-- Respuestas del chat, en orden.
CREATE OR REPLACE FUNCTION fn_chat_list()
RETURNS TABLE(pregunta varchar, palabras_clave varchar, respuesta varchar, enlace_texto varchar,
  enlace_ruta varchar, destacada boolean) LANGUAGE sql STABLE AS $$
  SELECT c.pregunta, c.palabras_clave, c.respuesta, c.enlace_texto, c.enlace_ruta, c.destacada
  FROM tb_chat_respuestas c ORDER BY c.orden;
$$;

-- Reemplaza la lista completa, con el mismo control de versión que la biografía.
CREATE OR REPLACE FUNCTION fn_chat_save(p_actor integer, p_items jsonb, p_version text)
RETURNS TABLE(resultado text, version text) LANGUAGE plpgsql AS $$
DECLARE v_current text; v_new text := md5(p_items::text);
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:chat'));
  v_current := md5(fn_chat_state()::text);
  IF v_current = v_new THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current IS DISTINCT FROM p_version THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  DELETE FROM tb_chat_respuestas;
  INSERT INTO tb_chat_respuestas (orden, pregunta, palabras_clave, respuesta, enlace_texto, enlace_ruta, destacada)
  SELECT e.orden, e.item->>'pregunta', e.item->>'palabrasClave', e.item->>'respuesta',
    NULLIF(e.item->>'enlaceTexto', ''), NULLIF(e.item->>'enlaceRuta', ''), (e.item->>'destacada')::boolean
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, orden);
  INSERT INTO tb_auditoria (id_actor, accion, entidad, cambios)
  VALUES (p_actor, 'chat_guardado', 'tb_chat_respuestas', jsonb_build_object('respuestas', jsonb_array_length(p_items)));
  RETURN QUERY SELECT 'guardado'::text, v_new;
END;
$$;

-- Anota una pregunta sin respuesta (o suma una vez más) y borra las que llevan 90 días sin repetirse.
CREATE OR REPLACE FUNCTION fn_chat_unanswered_note(p_normalized text, p_example text)
RETURNS void LANGUAGE sql AS $$
  DELETE FROM tb_chat_sin_respuesta WHERE ultima_vez < now() - interval '90 days';
  INSERT INTO tb_chat_sin_respuesta (texto_normalizado, ejemplo) VALUES (p_normalized, p_example)
  ON CONFLICT (texto_normalizado) DO UPDATE SET veces = tb_chat_sin_respuesta.veces + 1, ultima_vez = now();
$$;

-- Responde una consulta del chat una sola vez por clave de idempotencia.
DROP FUNCTION IF EXISTS fn_chat_send(integer, uuid, text, jsonb, text, text);
CREATE OR REPLACE FUNCTION fn_chat_send(
  p_user integer, p_key uuid, p_hash text, p_response jsonb, p_unanswered text, p_example text, p_version text)
RETURNS TABLE(resultado text, respuesta jsonb) LANGUAGE plpgsql AS $$
DECLARE v_send tb_chat_envios%ROWTYPE;
BEGIN
  IF NOT fn_has_permission(p_user, 'participacion.enviar') THEN RETURN; END IF;
  IF NOT (SELECT aceptado FROM fn_legal_accepted(p_user, p_version)) THEN RETURN; END IF;
  -- La clave se bloquea también antes de que exista la fila, y el contador se guarda en esta transacción.
  PERFORM pg_advisory_xact_lock(p_user, hashtext('chat:' || p_key::text));
  SELECT e.* INTO v_send FROM tb_chat_envios e WHERE e.id_usuario = p_user AND e.clave_idempotencia = p_key;
  IF FOUND THEN
    IF v_send.mensaje_hash <> p_hash THEN
      RETURN QUERY SELECT 'conflicto'::text, NULL::jsonb;
    ELSE
      RETURN QUERY SELECT 'guardado'::text, v_send.respuesta;
    END IF;
    RETURN;
  END IF;
  INSERT INTO tb_chat_envios (id_usuario, clave_idempotencia, mensaje_hash, respuesta)
  VALUES (p_user, p_key, p_hash, p_response);
  IF p_unanswered IS NOT NULL THEN PERFORM fn_chat_unanswered_note(p_unanswered, p_example); END IF;
  RETURN QUERY SELECT 'guardado'::text, p_response;
END;
$$;

-- Consulta del chat ya enviada con esa clave, para responder un reintento sin gastar el límite.
CREATE OR REPLACE FUNCTION fn_chat_by_key(p_user integer, p_key uuid)
RETURNS TABLE(mensaje_hash varchar, respuesta jsonb) LANGUAGE sql STABLE AS $$
  SELECT e.mensaje_hash, e.respuesta FROM tb_chat_envios e
  WHERE e.id_usuario = p_user AND e.clave_idempotencia = p_key AND fn_has_permission(p_user, 'participacion.enviar');
$$;

-- Preguntas que el chat no supo responder, de más a menos repetidas.
CREATE OR REPLACE FUNCTION fn_chat_unanswered_list(p_actor integer, p_limit integer)
RETURNS TABLE(texto_normalizado varchar, ejemplo varchar, veces integer, ultima_vez timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT s.texto_normalizado, s.ejemplo, s.veces, s.ultima_vez FROM tb_chat_sin_respuesta s
  WHERE fn_has_permission(p_actor, 'contenido.editar')
  ORDER BY s.veces DESC, s.ultima_vez DESC LIMIT p_limit;
$$;

-- Descartar una pregunta ya atendida; repetirlo no falla.
CREATE OR REPLACE FUNCTION fn_chat_unanswered_delete(p_actor integer, p_normalized text)
RETURNS TABLE(borrada boolean) LANGUAGE plpgsql AS $$
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  DELETE FROM tb_chat_sin_respuesta WHERE texto_normalizado = p_normalized;
  RETURN QUERY SELECT true;
END;
$$;

-- Crear es idempotente por (usuario, clave): repetir el envío devuelve la misma fila con
-- `nueva = false`. La base repite la comprobación del permiso aunque la API ya lo hiciera.

-- Crea una alerta; repetirla con la misma clave devuelve la ya creada.
DROP FUNCTION IF EXISTS fn_alert_create(integer, uuid, text, text, text, text, text);
CREATE OR REPLACE FUNCTION fn_alert_create(p_user integer, p_key uuid, p_type text, p_sector text,
  p_reference text, p_description text, p_photo text, p_version text)
RETURNS TABLE(id_alerta integer, tipo varchar, sector varchar, referencia varchar, descripcion varchar,
  foto varchar, estado varchar, creado_en timestamptz, nueva boolean)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE v_rows integer;
BEGIN
  IF NOT fn_has_permission(p_user, 'participacion.enviar') THEN RETURN; END IF;
  IF NOT (SELECT aceptado FROM fn_legal_accepted(p_user, p_version)) THEN RETURN; END IF;
  INSERT INTO tb_alertas (id_usuario, clave_idempotencia, tipo, sector, referencia, descripcion, foto)
  VALUES (p_user, p_key, p_type, p_sector, p_reference, p_description, p_photo)
  ON CONFLICT ON CONSTRAINT uq_alertas_idempotencia DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT a.id_alerta, a.tipo, a.sector, a.referencia, a.descripcion, a.foto, a.estado,
    a.creado_en, v_rows > 0
  FROM tb_alertas a WHERE a.id_usuario = p_user AND a.clave_idempotencia = p_key;
END;
$$;

-- Alerta ya enviada con esa clave (un reintento no vuelve a procesar la foto).
CREATE OR REPLACE FUNCTION fn_alert_by_key(p_user integer, p_key uuid)
RETURNS TABLE(id_alerta integer, tipo varchar, sector varchar, referencia varchar, descripcion varchar,
  foto varchar, estado varchar, creado_en timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT a.id_alerta, a.tipo, a.sector, a.referencia, a.descripcion, a.foto, a.estado, a.creado_en
  FROM tb_alertas a WHERE a.id_usuario = p_user AND a.clave_idempotencia = p_key;
$$;

-- Historial de quien la envió, también las borradas; `publica` dice si hoy se ve en el sitio.
DROP FUNCTION IF EXISTS fn_alerts_mine(integer, integer);
CREATE OR REPLACE FUNCTION fn_alerts_mine(p_user integer, p_limit integer)
RETURNS TABLE(id_alerta integer, tipo varchar, sector varchar, referencia varchar, descripcion varchar,
  foto varchar, estado varchar, creado_en timestamptz, publica boolean)
LANGUAGE sql STABLE AS $$
  SELECT a.id_alerta, a.tipo, a.sector, a.referencia, a.descripcion, a.foto, a.estado, a.creado_en,
    a.publica AND a.borrada_en IS NULL
  FROM tb_alertas a WHERE a.id_usuario = p_user ORDER BY a.id_alerta DESC LIMIT p_limit;
$$;

-- Crea una sugerencia; repetirla con la misma clave devuelve la ya creada.
DROP FUNCTION IF EXISTS fn_suggestion_create(integer, uuid, text, text);
CREATE OR REPLACE FUNCTION fn_suggestion_create(p_user integer, p_key uuid, p_topic text, p_message text, p_version text)
RETURNS TABLE(id_sugerencia integer, tema varchar, mensaje varchar, estado varchar, creado_en timestamptz, nueva boolean)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE v_rows integer;
BEGIN
  IF NOT fn_has_permission(p_user, 'participacion.enviar') THEN RETURN; END IF;
  IF NOT (SELECT aceptado FROM fn_legal_accepted(p_user, p_version)) THEN RETURN; END IF;
  INSERT INTO tb_sugerencias (id_usuario, clave_idempotencia, tema, mensaje)
  VALUES (p_user, p_key, p_topic, p_message)
  ON CONFLICT ON CONSTRAINT uq_sugerencias_idempotencia DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT s.id_sugerencia, s.tema, s.mensaje, s.estado, s.creado_en, v_rows > 0
  FROM tb_sugerencias s WHERE s.id_usuario = p_user AND s.clave_idempotencia = p_key;
END;
$$;

-- Sugerencia ya enviada con esa clave (un reintento no consume el límite de envíos).
CREATE OR REPLACE FUNCTION fn_suggestion_by_key(p_user integer, p_key uuid)
RETURNS TABLE(id_sugerencia integer, tema varchar, mensaje varchar, estado varchar, creado_en timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT s.id_sugerencia, s.tema, s.mensaje, s.estado, s.creado_en
  FROM tb_sugerencias s WHERE s.id_usuario = p_user AND s.clave_idempotencia = p_key;
$$;

-- Últimas sugerencias enviadas por la cuenta.
CREATE OR REPLACE FUNCTION fn_suggestions_mine(p_user integer, p_limit integer)
RETURNS TABLE(id_sugerencia integer, tema varchar, mensaje varchar, estado varchar, creado_en timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT s.id_sugerencia, s.tema, s.mensaje, s.estado, s.creado_en
  FROM tb_sugerencias s WHERE s.id_usuario = p_user ORDER BY s.id_sugerencia DESC LIMIT p_limit;
$$;

-- Lista del panel sin las borradas, por estado (nulo = todos), con el nombre y el correo de quien la envió.
DROP FUNCTION IF EXISTS fn_alerts_list(integer, text, integer, integer);
CREATE OR REPLACE FUNCTION fn_alerts_list(p_actor integer, p_state text, p_limit integer, p_offset integer)
RETURNS TABLE(id_alerta integer, tipo varchar, sector varchar, referencia varchar, descripcion varchar,
  foto varchar, estado varchar, creado_en timestamptz, publica boolean, anonima boolean, autor varchar, correo varchar)
LANGUAGE sql STABLE AS $$
  SELECT a.id_alerta, a.tipo, a.sector, a.referencia, a.descripcion, a.foto, a.estado, a.creado_en,
    a.publica, a.anonima, u.nombres_completos, u.correo
  FROM tb_alertas a JOIN tb_usuarios u ON u.id_usuario = a.id_usuario
  WHERE fn_has_permission(p_actor, 'participacion.ver') AND a.borrada_en IS NULL
    AND (p_state IS NULL OR a.estado = p_state)
  ORDER BY a.id_alerta DESC LIMIT p_limit OFFSET p_offset;
$$;

-- Sugerencias del panel sin las borradas, por estado (nulo = todos), con quien la envió.
DROP FUNCTION IF EXISTS fn_suggestions_list(integer, text, integer, integer);
CREATE OR REPLACE FUNCTION fn_suggestions_list(p_actor integer, p_state text, p_limit integer, p_offset integer)
RETURNS TABLE(id_sugerencia integer, tema varchar, mensaje varchar, estado varchar, creado_en timestamptz,
  anonima boolean, autor varchar, correo varchar)
LANGUAGE sql STABLE AS $$
  SELECT s.id_sugerencia, s.tema, s.mensaje, s.estado, s.creado_en, s.anonima, u.nombres_completos, u.correo
  FROM tb_sugerencias s JOIN tb_usuarios u ON u.id_usuario = s.id_usuario
  WHERE fn_has_permission(p_actor, 'participacion.ver') AND s.borrada_en IS NULL
    AND (p_state IS NULL OR s.estado = p_state)
  ORDER BY s.id_sugerencia DESC LIMIT p_limit OFFSET p_offset;
$$;

-- Cuántas alertas y sugerencias hay en cada estado, sin las borradas.
CREATE OR REPLACE FUNCTION fn_participation_counts(p_actor integer)
RETURNS TABLE(tipo text, estado varchar, total integer) LANGUAGE sql STABLE AS $$
  SELECT 'alertas', a.estado, count(*)::integer FROM tb_alertas a
  WHERE fn_has_permission(p_actor, 'participacion.ver') AND a.borrada_en IS NULL GROUP BY a.estado
  UNION ALL
  SELECT 'sugerencias', s.estado, count(*)::integer FROM tb_sugerencias s
  WHERE fn_has_permission(p_actor, 'participacion.ver') AND s.borrada_en IS NULL GROUP BY s.estado;
$$;

-- Alertas publicadas para cualquier visitante; el nombre solo si se eligió mostrarlo y `mia` para quien la envió.
CREATE OR REPLACE FUNCTION fn_alerts_public(p_user integer, p_limit integer, p_offset integer)
RETURNS TABLE(id_alerta integer, tipo varchar, sector varchar, referencia varchar, descripcion varchar,
  foto varchar, estado varchar, creado_en timestamptz, autor varchar, mia boolean, total integer)
LANGUAGE sql STABLE AS $$
  SELECT a.id_alerta, a.tipo, a.sector, a.referencia, a.descripcion, a.foto, a.estado, a.creado_en,
    CASE WHEN a.anonima THEN NULL ELSE u.nombres_completos END, a.id_usuario IS NOT DISTINCT FROM p_user,
    (count(*) OVER ())::integer
  FROM tb_alertas a JOIN tb_usuarios u ON u.id_usuario = a.id_usuario
  WHERE a.publica AND a.borrada_en IS NULL
  ORDER BY a.id_alerta DESC LIMIT p_limit OFFSET p_offset;
$$;

-- Sugerencias no borradas para cualquier visitante, con el nombre salvo que se haya ocultado y `mia` para quien la envió.
CREATE OR REPLACE FUNCTION fn_suggestions_public(p_user integer, p_limit integer, p_offset integer)
RETURNS TABLE(id_sugerencia integer, tema varchar, mensaje varchar, estado varchar, creado_en timestamptz,
  autor varchar, mia boolean, total integer)
LANGUAGE sql STABLE AS $$
  SELECT s.id_sugerencia, s.tema, s.mensaje, s.estado, s.creado_en,
    CASE WHEN s.anonima THEN NULL ELSE u.nombres_completos END, s.id_usuario IS NOT DISTINCT FROM p_user,
    (count(*) OVER ())::integer
  FROM tb_sugerencias s JOIN tb_usuarios u ON u.id_usuario = s.id_usuario
  WHERE s.borrada_en IS NULL
  ORDER BY s.id_sugerencia DESC LIMIT p_limit OFFSET p_offset;
$$;

-- Cambia el estado con control optimista: «sin_cambios» si ya lo tiene y «conflicto» si otra persona lo cambió.
CREATE OR REPLACE FUNCTION fn_alert_state_change(p_actor integer, p_id integer, p_state text, p_expected text)
RETURNS TABLE(resultado text, estado varchar) LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE v_current varchar;
BEGIN
  IF NOT fn_has_permission(p_actor, 'participacion.gestionar') THEN RETURN; END IF;
  SELECT a.estado INTO v_current FROM tb_alertas a WHERE a.id_alerta = p_id AND a.borrada_en IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_current = p_state THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current <> p_expected THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  UPDATE tb_alertas a SET estado = p_state, actualizado_en = now(), actualizado_por = p_actor WHERE a.id_alerta = p_id;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
  VALUES (p_actor, 'alerta_estado', 'tb_alertas', p_id, jsonb_build_object('antes', v_current, 'despues', p_state));
  RETURN QUERY SELECT 'guardado'::text, p_state::varchar;
END;
$$;

-- Cambia el estado de una sugerencia si nadie lo cambió antes, y lo audita.
CREATE OR REPLACE FUNCTION fn_suggestion_state_change(p_actor integer, p_id integer, p_state text, p_expected text)
RETURNS TABLE(resultado text, estado varchar) LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE v_current varchar;
BEGIN
  IF NOT fn_has_permission(p_actor, 'participacion.gestionar') THEN RETURN; END IF;
  SELECT s.estado INTO v_current FROM tb_sugerencias s WHERE s.id_sugerencia = p_id AND s.borrada_en IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_current = p_state THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current <> p_expected THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  UPDATE tb_sugerencias s SET estado = p_state, actualizado_en = now(), actualizado_por = p_actor WHERE s.id_sugerencia = p_id;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
  VALUES (p_actor, 'sugerencia_estado', 'tb_sugerencias', p_id, jsonb_build_object('antes', v_current, 'despues', p_state));
  RETURN QUERY SELECT 'guardado'::text, p_state::varchar;
END;
$$;

-- La foto de una alerta publicada la ve cualquiera; si no, solo quien la envió o quien revisa la participación.
CREATE OR REPLACE FUNCTION fn_alert_photo_allowed(p_user integer, p_photo text)
RETURNS TABLE(permitido boolean) LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM tb_alertas a WHERE a.foto = p_photo
    AND ((a.publica AND a.borrada_en IS NULL) OR a.id_usuario = p_user OR fn_has_permission(p_user, 'participacion.ver')));
$$;

-- Publica u oculta una alerta y su nombre, con control optimista sobre lo que veía el panel.
CREATE OR REPLACE FUNCTION fn_alert_visibility_change(p_actor integer, p_id integer, p_public boolean,
  p_anonymous boolean, p_expected_public boolean, p_expected_anonymous boolean)
RETURNS TABLE(resultado text, publica boolean, anonima boolean) LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE v_public boolean; v_anonymous boolean;
BEGIN
  IF NOT fn_has_permission(p_actor, 'participacion.gestionar') THEN RETURN; END IF;
  SELECT a.publica, a.anonima INTO v_public, v_anonymous FROM tb_alertas a
  WHERE a.id_alerta = p_id AND a.borrada_en IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF (v_public, v_anonymous) = (p_public, p_anonymous) THEN
    RETURN QUERY SELECT 'sin_cambios'::text, v_public, v_anonymous; RETURN;
  END IF;
  IF (v_public, v_anonymous) <> (p_expected_public, p_expected_anonymous) THEN
    RETURN QUERY SELECT 'conflicto'::text, v_public, v_anonymous; RETURN;
  END IF;
  UPDATE tb_alertas a SET publica = p_public, anonima = p_anonymous, actualizado_en = now(), actualizado_por = p_actor
  WHERE a.id_alerta = p_id;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
  VALUES (p_actor, 'alerta_visibilidad', 'tb_alertas', p_id, jsonb_build_object(
    'antes', jsonb_build_object('publica', v_public, 'anonima', v_anonymous),
    'despues', jsonb_build_object('publica', p_public, 'anonima', p_anonymous)));
  RETURN QUERY SELECT 'guardado'::text, p_public, p_anonymous;
END;
$$;

-- Oculta o muestra el nombre de una sugerencia, con control optimista sobre lo que veía el panel.
CREATE OR REPLACE FUNCTION fn_suggestion_visibility_change(p_actor integer, p_id integer, p_anonymous boolean,
  p_expected_anonymous boolean)
RETURNS TABLE(resultado text, anonima boolean) LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE v_anonymous boolean;
BEGIN
  IF NOT fn_has_permission(p_actor, 'participacion.gestionar') THEN RETURN; END IF;
  SELECT s.anonima INTO v_anonymous FROM tb_sugerencias s
  WHERE s.id_sugerencia = p_id AND s.borrada_en IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_anonymous = p_anonymous THEN RETURN QUERY SELECT 'sin_cambios'::text, v_anonymous; RETURN; END IF;
  IF v_anonymous <> p_expected_anonymous THEN RETURN QUERY SELECT 'conflicto'::text, v_anonymous; RETURN; END IF;
  UPDATE tb_sugerencias s SET anonima = p_anonymous, actualizado_en = now(), actualizado_por = p_actor
  WHERE s.id_sugerencia = p_id;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
  VALUES (p_actor, 'sugerencia_visibilidad', 'tb_sugerencias', p_id,
    jsonb_build_object('antes', jsonb_build_object('anonima', v_anonymous), 'despues', jsonb_build_object('anonima', p_anonymous)));
  RETURN QUERY SELECT 'guardado'::text, p_anonymous;
END;
$$;

-- Borrado lógico de una alerta; repetirlo devuelve «sin_cambios» y no vuelve a auditarlo.
CREATE OR REPLACE FUNCTION fn_alert_delete(p_actor integer, p_id integer)
RETURNS TABLE(resultado text) LANGUAGE plpgsql AS $$
DECLARE v_deleted timestamptz;
BEGIN
  IF NOT fn_has_permission(p_actor, 'participacion.gestionar') THEN RETURN; END IF;
  SELECT a.borrada_en INTO v_deleted FROM tb_alertas a WHERE a.id_alerta = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_deleted IS NOT NULL THEN RETURN QUERY SELECT 'sin_cambios'::text; RETURN; END IF;
  UPDATE tb_alertas a SET borrada_en = now(), borrada_por = p_actor WHERE a.id_alerta = p_id;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro) VALUES (p_actor, 'alerta_borrada', 'tb_alertas', p_id);
  RETURN QUERY SELECT 'guardado'::text;
END;
$$;

-- Borrado lógico de una sugerencia; repetirlo devuelve «sin_cambios» y no vuelve a auditarlo.
CREATE OR REPLACE FUNCTION fn_suggestion_delete(p_actor integer, p_id integer)
RETURNS TABLE(resultado text) LANGUAGE plpgsql AS $$
DECLARE v_deleted timestamptz;
BEGIN
  IF NOT fn_has_permission(p_actor, 'participacion.gestionar') THEN RETURN; END IF;
  SELECT s.borrada_en INTO v_deleted FROM tb_sugerencias s WHERE s.id_sugerencia = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_deleted IS NOT NULL THEN RETURN QUERY SELECT 'sin_cambios'::text; RETURN; END IF;
  UPDATE tb_sugerencias s SET borrada_en = now(), borrada_por = p_actor WHERE s.id_sugerencia = p_id;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro) VALUES (p_actor, 'sugerencia_borrada', 'tb_sugerencias', p_id);
  RETURN QUERY SELECT 'guardado'::text;
END;
$$;
