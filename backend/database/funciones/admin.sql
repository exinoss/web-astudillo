-- Lista paginada y filtrable de cuentas para el panel; p_query ya llega con los comodines de
-- LIKE escapados. El orden no depende de es_maestro para no delatar qué cuenta es la maestra.
-- Siempre devuelve al menos una fila con el total, aunque la página pedida quede vacía
-- (id_usuario nulo); así la paginación conoce el total real.
DROP FUNCTION IF EXISTS fn_admin_users(text, integer, integer);
CREATE OR REPLACE FUNCTION fn_admin_users(p_query text, p_role text, p_state text,
  p_limit integer, p_offset integer)
RETURNS TABLE(id_usuario integer, correo varchar, nombres_completos varchar, rol varchar,
  es_maestro boolean, estado varchar, total bigint)
LANGUAGE sql STABLE AS $$
  WITH filtradas AS (
    SELECT u.* FROM tb_usuarios u
    WHERE (p_query IS NULL
        OR u.correo ILIKE '%' || p_query || '%' ESCAPE '\'
        OR u.nombres_completos ILIKE '%' || p_query || '%' ESCAPE '\')
      AND (p_role IS NULL OR u.rol = p_role)
      AND (p_state IS NULL OR u.estado = p_state)
  )
  SELECT pagina.id_usuario, pagina.correo, pagina.nombres_completos, pagina.rol,
    pagina.es_maestro, pagina.estado, conteo.total
  FROM (SELECT count(*) AS total FROM filtradas) conteo
  LEFT JOIN LATERAL (
    SELECT * FROM filtradas f
    ORDER BY array_position(ARRAY['admin', 'coadmin', 'analista', 'votante']::varchar[], f.rol),
      lower(f.correo)
    LIMIT p_limit OFFSET p_offset
  ) pagina ON true;
$$;

-- Cuenta objetivo de un cambio de rol, con los datos que decide la jerarquía.
CREATE OR REPLACE FUNCTION fn_user_by_id(p_user integer)
RETURNS SETOF tb_usuarios LANGUAGE sql STABLE AS $$
  SELECT * FROM tb_usuarios WHERE id_usuario = p_user;
$$;

-- Cambia el rol respetando la jerarquía aunque la API fallara: nadie cambia su propio rol
-- ni el del maestro, y solo el maestro cambia el de un admin. Sin fila = cambio denegado.
-- `p_expected` es el rol que veía quien hace el cambio: si otra persona lo cambió antes, no se
-- aplica (sin filas → 409). Pedir el rol que ya tiene es idempotente.
DROP FUNCTION IF EXISTS fn_role_change(integer, integer, text);
CREATE OR REPLACE FUNCTION fn_role_change(p_actor integer, p_target integer, p_role text, p_expected text)
RETURNS SETOF tb_usuarios LANGUAGE plpgsql AS $$
DECLARE v_actor tb_usuarios%ROWTYPE; v_target tb_usuarios%ROWTYPE;
BEGIN
  IF p_role NOT IN ('votante', 'coadmin', 'admin') OR p_actor = p_target THEN RETURN; END IF;
  SELECT * INTO v_actor FROM fn_authorized_user(p_actor, 'usuarios.rol.cambiar');
  IF NOT FOUND THEN RETURN; END IF;
  IF p_role = 'admin' AND NOT v_actor.es_maestro THEN RETURN; END IF;
  SELECT * INTO v_target FROM tb_usuarios WHERE id_usuario = p_target FOR UPDATE;
  IF NOT FOUND OR v_target.es_maestro THEN RETURN; END IF;
  IF v_target.rol = 'admin' AND NOT v_actor.es_maestro THEN RETURN; END IF;
  IF v_target.rol <> p_role AND v_target.rol IS DISTINCT FROM p_expected THEN RETURN; END IF;
  IF v_target.rol <> p_role THEN
    UPDATE tb_usuarios SET rol = p_role, actualizado_en = now() WHERE id_usuario = p_target;
    INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
    VALUES (p_actor, 'rol_cambiado', 'tb_usuarios', p_target,
      jsonb_build_object('antes', v_target.rol, 'despues', p_role));
  END IF;
  RETURN QUERY SELECT * FROM tb_usuarios WHERE id_usuario = p_target;
END;
$$;

-- Crea el admin maestro desde la línea de comandos. El índice único parcial impide
-- un segundo maestro incluso con dos ejecuciones simultáneas.
CREATE OR REPLACE FUNCTION fn_master_create(p_email text, p_name text, p_hash text)
RETURNS TABLE(resultado text, id_usuario integer) LANGUAGE plpgsql AS $$
DECLARE v_user integer;
BEGIN
  IF EXISTS (SELECT 1 FROM tb_usuarios u WHERE u.es_maestro) THEN
    RETURN QUERY SELECT 'ya_existe_maestro'::text, NULL::integer; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM tb_usuarios u WHERE lower(u.correo) = lower(p_email)) THEN
    RETURN QUERY SELECT 'correo_en_uso'::text, NULL::integer; RETURN;
  END IF;
  INSERT INTO tb_usuarios (correo, nombres_completos, correo_verificado_en, rol, es_maestro)
  VALUES (p_email, p_name, now(), 'admin', true)
  RETURNING tb_usuarios.id_usuario INTO v_user;
  INSERT INTO tb_identidades_autenticacion (id_usuario, proveedor, contrasenia_hash)
  VALUES (v_user, 'correo', p_hash);
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro)
  VALUES (NULL, 'maestro_creado', 'tb_usuarios', v_user);
  RETURN QUERY SELECT 'creado'::text, v_user;
END;
$$;

-- Pasa el rol de maestro a otra cuenta activa; el anterior queda como admin normal.
CREATE OR REPLACE FUNCTION fn_master_transfer(p_email text)
RETURNS TABLE(resultado text, id_usuario integer) LANGUAGE plpgsql AS $$
DECLARE v_old integer; v_new integer;
BEGIN
  SELECT u.id_usuario INTO v_old FROM tb_usuarios u WHERE u.es_maestro FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'sin_maestro'::text, NULL::integer; RETURN; END IF;
  SELECT u.id_usuario INTO v_new FROM tb_usuarios u
  WHERE lower(u.correo) = lower(p_email) AND u.estado = 'activo' FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'no_encontrado'::text, NULL::integer; RETURN; END IF;
  IF v_new = v_old THEN RETURN QUERY SELECT 'ya_es_maestro'::text, v_new; RETURN; END IF;
  -- Primero se retira el anterior: el índice único no admite dos maestros ni un instante.
  UPDATE tb_usuarios SET es_maestro = false, actualizado_en = now() WHERE tb_usuarios.id_usuario = v_old;
  UPDATE tb_usuarios SET rol = 'admin', es_maestro = true, actualizado_en = now()
  WHERE tb_usuarios.id_usuario = v_new;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
  VALUES (NULL, 'maestro_transferido', 'tb_usuarios', v_new, jsonb_build_object('anterior', v_old));
  RETURN QUERY SELECT 'transferido'::text, v_new;
END;
$$;

-- Activa o desactiva otra cuenta con la misma jerarquía que el cambio de rol. Al desactivar
-- revoca sus sesiones; las funciones de acceso ya rechazan cuentas bloqueadas.
-- Igual que el rol: `p_expected` es el estado que veía quien actúa; si otra persona lo cambió
-- antes, no se aplica (sin filas → 409). Pedir el estado que ya tiene es idempotente.
DROP FUNCTION IF EXISTS fn_user_state_change(integer, integer, text);
CREATE OR REPLACE FUNCTION fn_user_state_change(p_actor integer, p_target integer, p_state text, p_expected text)
RETURNS SETOF tb_usuarios LANGUAGE plpgsql AS $$
DECLARE v_actor tb_usuarios%ROWTYPE; v_target tb_usuarios%ROWTYPE;
BEGIN
  IF p_state NOT IN ('activo', 'bloqueado') OR p_actor = p_target THEN RETURN; END IF;
  SELECT * INTO v_actor FROM fn_authorized_user(p_actor, 'usuarios.estado.cambiar');
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_target FROM tb_usuarios WHERE id_usuario = p_target FOR UPDATE;
  IF NOT FOUND OR v_target.es_maestro THEN RETURN; END IF;
  IF v_target.rol = 'admin' AND NOT v_actor.es_maestro THEN RETURN; END IF;
  IF v_target.estado <> p_state AND v_target.estado IS DISTINCT FROM p_expected THEN RETURN; END IF;
  IF v_target.estado <> p_state THEN
    UPDATE tb_usuarios SET estado = p_state, actualizado_en = now() WHERE id_usuario = p_target;
    IF p_state = 'bloqueado' THEN
      UPDATE tb_sesiones SET revocado_en = now() WHERE id_usuario = p_target AND revocado_en IS NULL;
    END IF;
    INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
    VALUES (p_actor, 'estado_cambiado', 'tb_usuarios', p_target,
      jsonb_build_object('antes', v_target.estado, 'despues', p_state));
  END IF;
  RETURN QUERY SELECT * FROM tb_usuarios WHERE id_usuario = p_target;
END;
$$;
