-- Funciones de datos de la API. SECURITY INVOKER conserva los privilegios del rol SQL.
-- Ninguna funcion recibe SQL dinamico ni confia en un rol enviado por el cliente.

CREATE OR REPLACE FUNCTION fn_cleanup_tokens() RETURNS void LANGUAGE sql AS $$
  DELETE FROM tb_token_autenticacion WHERE expira_en < now();
$$;

CREATE OR REPLACE FUNCTION fn_user_by_email(p_email text)
RETURNS SETOF tb_usuarios LANGUAGE sql STABLE AS $$
  SELECT * FROM tb_usuarios WHERE lower(correo) = p_email;
$$;

-- Busca y bloquea la cuenta por correo durante una transacción.
CREATE OR REPLACE FUNCTION fn_user_by_email_locked(p_email text)
RETURNS SETOF tb_usuarios LANGUAGE sql VOLATILE AS $$
  SELECT * FROM tb_usuarios WHERE lower(correo) = p_email FOR UPDATE;
$$;

CREATE OR REPLACE FUNCTION fn_active_user(p_user integer)
RETURNS SETOF tb_usuarios LANGUAGE sql STABLE AS $$
  SELECT * FROM tb_usuarios WHERE id_usuario = p_user AND estado = 'activo';
$$;

-- Devuelve la cuenta activa si su rol tiene el permiso solicitado.
CREATE OR REPLACE FUNCTION fn_authorized_user(p_user integer, p_permission text)
RETURNS SETOF tb_usuarios LANGUAGE sql STABLE AS $$
  SELECT u.* FROM tb_usuarios u
  JOIN tb_roles r ON r.rol = u.rol
  JOIN tb_rol_permisos rp ON rp.id_rol = r.id_rol
  JOIN tb_permisos p ON p.id_permiso = rp.id_permiso
  WHERE u.id_usuario = p_user AND u.estado = 'activo' AND p.codigo = p_permission;
$$;

-- Indica si la cuenta tiene identidad por contraseña, Google o ambas.
CREATE OR REPLACE FUNCTION fn_account_methods(p_user integer)
RETURNS TABLE(tiene_contrasenia boolean, tiene_google boolean)
LANGUAGE sql STABLE AS $$
  SELECT
    EXISTS (SELECT 1 FROM tb_identidades_autenticacion
      WHERE id_usuario = p_user AND proveedor = 'correo'),
    EXISTS (SELECT 1 FROM tb_identidades_autenticacion
      WHERE id_usuario = p_user AND proveedor = 'google');
$$;

CREATE OR REPLACE FUNCTION fn_legal_accepted(p_user integer, p_version text)
RETURNS TABLE(aceptado boolean) LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM tb_aceptaciones_legales a WHERE a.id_usuario = p_user AND a.version = p_version);
$$;

CREATE OR REPLACE FUNCTION fn_legal_accept(p_user integer, p_version text, p_text text)
RETURNS TABLE(resultado text, aceptado_en timestamptz) LANGUAGE plpgsql AS $$
DECLARE v_accept tb_aceptaciones_legales%ROWTYPE;
BEGIN
  -- El bloqueo serializa confirmaciones de varias pestañas y conserva la primera fecha.
  PERFORM 1 FROM tb_usuarios WHERE id_usuario = p_user AND estado = 'activo' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT fn_has_permission(p_user, 'perfil.ver') THEN RETURN; END IF;
  SELECT a.* INTO v_accept FROM tb_aceptaciones_legales a WHERE a.id_usuario = p_user AND a.version = p_version;
  IF FOUND THEN
    IF v_accept.texto <> p_text THEN
      RETURN QUERY SELECT 'conflicto'::text, NULL::timestamptz;
    ELSE
      RETURN QUERY SELECT 'guardado'::text, v_accept.aceptado_en;
    END IF;
    RETURN;
  END IF;
  INSERT INTO tb_aceptaciones_legales (id_usuario, version, texto) VALUES (p_user, p_version, p_text)
  RETURNING * INTO v_accept;
  RETURN QUERY SELECT 'guardado'::text, v_accept.aceptado_en;
END;
$$;

-- El enlace de registro vale en cualquier navegador: no hay verificador de navegador.
DROP FUNCTION IF EXISTS fn_pending_create(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS fn_pending_create(text, text, text, text, text);
CREATE OR REPLACE FUNCTION fn_pending_create(
  p_email text, p_token_hash text, p_name text, p_address text, p_password_hash text, p_version text, p_text text
) RETURNS TABLE(id_token_autenticacion integer) LANGUAGE plpgsql AS $$
-- Una sola solicitud válida por correo. Si hay una de hace menos de un minuto (doble envío,
-- reintento de red, dos pestañas) no crea otra ni hace enviar otro correo: devuelve vacío.
-- Pasado ese minuto, la nueva anula las anteriores (el borrado arrastra su registro pendiente).
DECLARE v_id integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('registro:' || lower(p_email)));
  IF EXISTS (SELECT 1 FROM tb_token_autenticacion t
    WHERE lower(t.correo) = lower(p_email) AND t.proposito = 'registro_correo'
      AND t.consumido_en IS NULL AND t.expira_en > now() AND t.creado_en > now() - interval '1 minute'
      AND EXISTS (SELECT 1 FROM tb_registros_pendientes p WHERE p.id_token_autenticacion = t.id_token_autenticacion
        AND p.version_legal = p_version AND p.texto_aceptacion = p_text AND p.aceptado_en IS NOT NULL)) THEN
    RETURN;
  END IF;
  DELETE FROM tb_token_autenticacion t
  WHERE lower(t.correo) = lower(p_email) AND t.proposito = 'registro_correo' AND t.consumido_en IS NULL;
  INSERT INTO tb_token_autenticacion (correo, proposito, token_hash, expira_en)
  VALUES (p_email, 'registro_correo', p_token_hash, now() + interval '30 minutes')
  RETURNING tb_token_autenticacion.id_token_autenticacion INTO v_id;
  INSERT INTO tb_registros_pendientes (id_token_autenticacion, nombres_completos, direccion, contrasenia_hash,
    version_legal, texto_aceptacion, aceptado_en)
  VALUES (v_id, p_name, p_address, p_password_hash, p_version, p_text, now());
  RETURN QUERY SELECT v_id;
END;
$$;

-- Lee y bloquea una solicitud de registro pendiente por hash de token.
DROP FUNCTION IF EXISTS fn_pending_get(text);
CREATE OR REPLACE FUNCTION fn_pending_get(p_hash text)
RETURNS TABLE(
  id_token_autenticacion integer, correo varchar(320), expira_en timestamptz,
  consumido_en timestamptz, nombres_completos varchar(200), direccion text, contrasenia_hash text,
  version_legal varchar(32), texto_aceptacion text, aceptado_en timestamptz
) LANGUAGE sql VOLATILE AS $$
  SELECT t.id_token_autenticacion, t.correo, t.expira_en, t.consumido_en,
    p.nombres_completos, p.direccion, p.contrasenia_hash, p.version_legal, p.texto_aceptacion, p.aceptado_en
  FROM tb_token_autenticacion t JOIN tb_registros_pendientes p
    ON p.id_token_autenticacion = t.id_token_autenticacion
  WHERE t.token_hash = p_hash AND t.proposito = 'registro_correo'
  FOR UPDATE OF t;
$$;

-- Indica si este enlace de registro ya se usó y la cuenta existe: abrirlo otra vez (recargar,
-- doble clic en el correo) responde como la primera vez en lugar de dar error.
CREATE OR REPLACE FUNCTION fn_registration_verified(p_hash text)
RETURNS TABLE(verificado boolean) LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM tb_token_autenticacion t JOIN tb_usuarios u ON lower(u.correo) = lower(t.correo)
    WHERE t.token_hash = p_hash AND t.proposito = 'registro_correo' AND t.consumido_en IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION fn_registration_complete(p_token integer)
RETURNS TABLE(id_usuario integer) LANGUAGE plpgsql AS $$
DECLARE v_token record; v_user integer;
BEGIN
  SELECT t.correo, p.nombres_completos, p.direccion, p.contrasenia_hash,
    p.version_legal, p.texto_aceptacion, p.aceptado_en
  INTO v_token FROM tb_token_autenticacion t JOIN tb_registros_pendientes p
    ON p.id_token_autenticacion = t.id_token_autenticacion
  WHERE t.id_token_autenticacion = p_token AND t.proposito = 'registro_correo'
    AND t.consumido_en IS NULL AND t.expira_en > now() AND p.version_legal IS NOT NULL
  FOR UPDATE OF t;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO tb_usuarios (correo, nombres_completos, direccion, correo_verificado_en)
  VALUES (v_token.correo, v_token.nombres_completos, v_token.direccion, now())
  RETURNING tb_usuarios.id_usuario INTO v_user;
  INSERT INTO tb_identidades_autenticacion (id_usuario, proveedor, contrasenia_hash)
  VALUES (v_user, 'correo', v_token.contrasenia_hash);
  INSERT INTO tb_aceptaciones_legales (id_usuario, version, texto, aceptado_en)
  VALUES (v_user, v_token.version_legal, v_token.texto_aceptacion, v_token.aceptado_en);
  UPDATE tb_token_autenticacion SET consumido_en = now() WHERE id_token_autenticacion = p_token;
  DELETE FROM tb_registros_pendientes WHERE id_token_autenticacion = p_token;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro)
  VALUES (v_user, 'cuenta_creada', 'tb_usuarios', v_user);
  RETURN QUERY SELECT v_user;
END;
$$;

CREATE OR REPLACE FUNCTION fn_google_user(p_sub text)
RETURNS SETOF tb_usuarios LANGUAGE sql STABLE AS $$
  SELECT u.* FROM tb_identidades_autenticacion i
  JOIN tb_usuarios u ON u.id_usuario = i.id_usuario
  WHERE i.proveedor = 'google' AND i.sujeto_externo = p_sub;
$$;

-- Crea una cuenta Google si el correo todavía no está registrado.
DROP FUNCTION IF EXISTS fn_google_user_create(text, text);
CREATE OR REPLACE FUNCTION fn_google_user_create(p_email text, p_name text, p_version text, p_text text)
RETURNS SETOF tb_usuarios LANGUAGE plpgsql AS $$
DECLARE v_user tb_usuarios%ROWTYPE;
BEGIN
  INSERT INTO tb_usuarios (correo, nombres_completos, correo_verificado_en)
  VALUES (p_email, p_name, now()) ON CONFLICT DO NOTHING RETURNING * INTO v_user;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO tb_aceptaciones_legales (id_usuario, version, texto) VALUES (v_user.id_usuario, p_version, p_text);
  RETURN NEXT v_user;
END;
$$;

-- Vincula el sub de Google al usuario y registra la auditoría.
CREATE OR REPLACE FUNCTION fn_google_identity_add(p_user integer, p_sub text)
RETURNS TABLE(id_identidad integer) LANGUAGE plpgsql AS $$
DECLARE v_id integer;
BEGIN
  INSERT INTO tb_identidades_autenticacion (id_usuario, proveedor, sujeto_externo)
  VALUES (p_user, 'google', p_sub) ON CONFLICT DO NOTHING
  RETURNING tb_identidades_autenticacion.id_identidad INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro)
    VALUES (p_user, 'google_vinculado', 'tb_identidades_autenticacion', v_id);
    RETURN QUERY SELECT v_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_google_identity_owner(p_sub text)
RETURNS TABLE(id_usuario integer) LANGUAGE sql STABLE AS $$
  SELECT i.id_usuario FROM tb_identidades_autenticacion i
  WHERE i.proveedor = 'google' AND i.sujeto_externo = p_sub;
$$;

-- Comprueba que el sub de Google pertenece a una cuenta activa concreta.
CREATE OR REPLACE FUNCTION fn_google_identity_for_user(p_user integer, p_sub text)
RETURNS TABLE(id_usuario integer) LANGUAGE sql STABLE AS $$
  SELECT u.id_usuario FROM tb_usuarios u JOIN tb_identidades_autenticacion i
    ON i.id_usuario = u.id_usuario
  WHERE u.id_usuario = p_user AND u.estado = 'activo'
    AND i.proveedor = 'google' AND i.sujeto_externo = p_sub;
$$;

-- Enlaces por correo de una cuenta existente (recuperar contraseña, acceso por enlace). Igual que
-- el registro: uno solo válido por correo y finalidad. Si hay uno de hace menos de un minuto (doble
-- envío, reintento) devuelve vacío y no se manda otro correo; pasado el minuto, el nuevo anula los anteriores.
DROP FUNCTION IF EXISTS fn_auth_token_create(integer, text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS fn_google_token_get(text);
CREATE OR REPLACE FUNCTION fn_auth_token_create(
  p_user integer, p_email text, p_purpose text, p_hash text, p_seconds integer
) RETURNS TABLE(id_token_autenticacion integer) LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('enlace:' || p_purpose || ':' || lower(p_email)));
  IF EXISTS (SELECT 1 FROM tb_token_autenticacion t
    WHERE lower(t.correo) = lower(p_email) AND t.proposito = p_purpose
      AND t.consumido_en IS NULL AND t.expira_en > now() AND t.creado_en > now() - interval '1 minute') THEN
    RETURN;
  END IF;
  DELETE FROM tb_token_autenticacion t
  WHERE lower(t.correo) = lower(p_email) AND t.proposito = p_purpose AND t.consumido_en IS NULL;
  RETURN QUERY INSERT INTO tb_token_autenticacion AS t (id_usuario, correo, proposito, token_hash, expira_en)
  VALUES (p_user, p_email, p_purpose, p_hash, now() + make_interval(secs => p_seconds))
  RETURNING t.id_token_autenticacion;
END;
$$;

CREATE OR REPLACE FUNCTION fn_auth_token_get(p_hash text, p_purpose text)
RETURNS SETOF tb_token_autenticacion LANGUAGE sql VOLATILE AS $$
  SELECT * FROM tb_token_autenticacion
  WHERE token_hash = p_hash AND proposito = p_purpose FOR UPDATE;
$$;

CREATE OR REPLACE FUNCTION fn_auth_token_consume(p_token integer)
RETURNS void LANGUAGE sql AS $$
  UPDATE tb_token_autenticacion SET consumido_en = now()
  WHERE id_token_autenticacion = p_token AND consumido_en IS NULL;
$$;

-- Borra el token temporal cuando no pudo enviarse su correo.
CREATE OR REPLACE FUNCTION fn_auth_token_delete(p_token integer)
RETURNS void LANGUAGE sql AS $$
  DELETE FROM tb_token_autenticacion WHERE id_token_autenticacion = p_token;
$$;

CREATE OR REPLACE FUNCTION fn_password_user(p_email text)
RETURNS TABLE(
  id_usuario integer, correo varchar(320), nombres_completos varchar(200),
  direccion text, rol varchar(40), estado varchar(20), contrasenia_hash text
) LANGUAGE sql STABLE AS $$
  SELECT u.id_usuario, u.correo, u.nombres_completos, u.direccion,
    u.rol, u.estado, i.contrasenia_hash
  FROM tb_usuarios u JOIN tb_identidades_autenticacion i
    ON i.id_usuario = u.id_usuario
  WHERE lower(u.correo) = p_email AND i.proveedor = 'correo';
$$;

-- Busca una cuenta activa con contraseña para iniciar recuperación.
CREATE OR REPLACE FUNCTION fn_reset_target(p_email text)
RETURNS TABLE(id_usuario integer) LANGUAGE sql STABLE AS $$
  SELECT u.id_usuario FROM tb_usuarios u JOIN tb_identidades_autenticacion i
    ON i.id_usuario = u.id_usuario
  WHERE lower(u.correo) = p_email AND i.proveedor = 'correo' AND u.estado = 'activo';
$$;

-- Cambia la contraseña, revoca sesiones y registra la auditoría.
CREATE OR REPLACE FUNCTION fn_password_reset(p_user integer, p_hash text)
RETURNS TABLE(id_identidad integer) LANGUAGE plpgsql AS $$
DECLARE v_id integer;
BEGIN
  UPDATE tb_identidades_autenticacion
  SET contrasenia_hash = p_hash, actualizado_en = now()
  WHERE tb_identidades_autenticacion.id_usuario = p_user AND proveedor = 'correo'
  RETURNING tb_identidades_autenticacion.id_identidad INTO v_id;
  IF v_id IS NULL THEN RETURN; END IF;
  UPDATE tb_sesiones SET revocado_en = now()
  WHERE tb_sesiones.id_usuario = p_user AND revocado_en IS NULL;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro)
  VALUES (p_user, 'contrasenia_restaurada', 'tb_identidades_autenticacion', v_id);
  RETURN QUERY SELECT v_id;
END;
$$;

-- Añade contraseña si la identidad Google reciente tiene permiso vigente.
CREATE OR REPLACE FUNCTION fn_password_add(p_user integer, p_sub text, p_hash text)
RETURNS TABLE(id_identidad integer) LANGUAGE plpgsql AS $$
DECLARE v_id integer;
BEGIN
  INSERT INTO tb_identidades_autenticacion (id_usuario, proveedor, contrasenia_hash)
  SELECT p_user, 'correo', p_hash WHERE EXISTS (
    SELECT 1 FROM tb_usuarios u JOIN tb_identidades_autenticacion g
      ON g.id_usuario = u.id_usuario AND g.proveedor = 'google'
      AND g.sujeto_externo = p_sub
    JOIN tb_roles r ON r.rol = u.rol
    JOIN tb_rol_permisos rp ON rp.id_rol = r.id_rol
    JOIN tb_permisos p ON p.id_permiso = rp.id_permiso
    WHERE u.id_usuario = p_user AND u.estado = 'activo'
      AND p.codigo = 'cuenta.contrasenia.agregar'
  ) ON CONFLICT (id_usuario, proveedor) DO NOTHING
  RETURNING tb_identidades_autenticacion.id_identidad INTO v_id;
  IF v_id IS NOT NULL THEN
    INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro)
    VALUES (p_user, 'contrasenia_agregada', 'tb_identidades_autenticacion', v_id);
    RETURN QUERY SELECT v_id;
  END IF;
END;
$$;

-- Lee y bloquea el hash actual si el usuario puede cambiar contraseña.
CREATE OR REPLACE FUNCTION fn_password_change_target(p_user integer)
RETURNS TABLE(contrasenia_hash text) LANGUAGE sql VOLATILE AS $$
  SELECT i.contrasenia_hash FROM tb_identidades_autenticacion i
  JOIN tb_usuarios u ON u.id_usuario = i.id_usuario
  JOIN tb_roles r ON r.rol = u.rol
  JOIN tb_rol_permisos rp ON rp.id_rol = r.id_rol
  JOIN tb_permisos p ON p.id_permiso = rp.id_permiso
  WHERE u.id_usuario = p_user AND u.estado = 'activo'
    AND i.proveedor = 'correo' AND p.codigo = 'cuenta.contrasenia.cambiar'
  FOR UPDATE OF i, u;
$$;

-- Guarda la contraseña nueva, revoca sesiones y registra la auditoría.
CREATE OR REPLACE FUNCTION fn_password_change(p_user integer, p_hash text)
RETURNS TABLE(id_identidad integer) LANGUAGE plpgsql AS $$
DECLARE v_id integer;
BEGIN
  UPDATE tb_identidades_autenticacion i
  SET contrasenia_hash = p_hash, actualizado_en = now()
  WHERE i.id_usuario = p_user AND i.proveedor = 'correo'
    AND EXISTS (SELECT 1 FROM fn_authorized_user(p_user, 'cuenta.contrasenia.cambiar'))
  RETURNING i.id_identidad INTO v_id;
  IF v_id IS NULL THEN RETURN; END IF;
  UPDATE tb_sesiones SET revocado_en = now()
  WHERE id_usuario = p_user AND revocado_en IS NULL;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro)
  VALUES (p_user, 'contrasenia_cambiada', 'tb_identidades_autenticacion', v_id);
  RETURN QUERY SELECT v_id;
END;
$$;

-- Crea una sesión de renovación con vencimiento de siete días.
CREATE OR REPLACE FUNCTION fn_session_create(p_user integer, p_hash text)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO tb_sesiones (id_usuario, token_hash, expira_en)
  VALUES (p_user, p_hash, now() + interval '7 days');
$$;

CREATE OR REPLACE FUNCTION fn_session_rotate(p_old_hash text, p_new_hash text)
RETURNS SETOF tb_usuarios LANGUAGE plpgsql AS $$
DECLARE v_user tb_usuarios%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user FROM tb_sesiones s
  JOIN tb_usuarios u ON u.id_usuario = s.id_usuario
  WHERE s.token_hash = p_old_hash AND s.revocado_en IS NULL
    AND s.expira_en > now() AND u.estado = 'activo' FOR UPDATE OF s;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE tb_sesiones SET token_hash = p_new_hash, token_hash_anterior = p_old_hash, rotado_en = now(),
    expira_en = now() + interval '7 days', ultimo_uso_en = now()
  WHERE token_hash = p_old_hash;
  RETURN NEXT v_user;
END;
$$;

-- Otra pestaña renovó con este mismo refresh hace menos de 30 s (renovaciones simultáneas):
-- la sesión sigue siendo válida. Solo da un acceso nuevo; el navegador ya recibió el refresh rotado.
CREATE OR REPLACE FUNCTION fn_session_recently_rotated(p_old_hash text)
RETURNS SETOF tb_usuarios LANGUAGE sql STABLE AS $$
  SELECT u.* FROM tb_sesiones s JOIN tb_usuarios u ON u.id_usuario = s.id_usuario
  WHERE s.token_hash_anterior = p_old_hash AND s.rotado_en > now() - interval '30 seconds'
    AND s.revocado_en IS NULL AND s.expira_en > now() AND u.estado = 'activo';
$$;

CREATE OR REPLACE FUNCTION fn_session_revoke(p_hash text)
RETURNS void LANGUAGE sql AS $$
  UPDATE tb_sesiones SET revocado_en = now()
  WHERE token_hash = p_hash AND revocado_en IS NULL;
$$;

DROP FUNCTION IF EXISTS fn_profile_update(integer, text, text);
CREATE OR REPLACE FUNCTION fn_profile_update(p_user integer, p_name text, p_address text, p_version integer)
RETURNS TABLE(resultado text, usuario jsonb, version_perfil integer) LANGUAGE plpgsql AS $$
DECLARE v_user tb_usuarios%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user FROM tb_usuarios u
  WHERE u.id_usuario = p_user AND fn_has_permission(p_user, 'perfil.editar') FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF p_version IS NULL OR p_version < 1 THEN
    RETURN QUERY SELECT 'conflicto'::text, NULL::jsonb, v_user.version_perfil;
    RETURN;
  END IF;
  -- Comparar primero los datos permite reconocer un guardado cuyo éxito no llegó al navegador.
  IF v_user.nombres_completos IS NOT DISTINCT FROM p_name AND v_user.direccion IS NOT DISTINCT FROM p_address THEN
    RETURN QUERY SELECT 'guardado'::text, to_jsonb(v_user), v_user.version_perfil;
    RETURN;
  END IF;
  IF v_user.version_perfil <> p_version THEN
    RETURN QUERY SELECT 'conflicto'::text, NULL::jsonb, v_user.version_perfil;
    RETURN;
  END IF;
  UPDATE tb_usuarios u SET nombres_completos = p_name, direccion = p_address,
    actualizado_en = now(), version_perfil = u.version_perfil + 1
  WHERE u.id_usuario = p_user RETURNING u.* INTO v_user;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
  VALUES (p_user, 'perfil_actualizado', 'tb_usuarios', p_user,
    '{"campos":["nombres_completos","direccion"]}'::jsonb);
  RETURN QUERY SELECT 'guardado'::text, to_jsonb(v_user), v_user.version_perfil;
END;
$$;

-- Códigos de permiso vigentes de una cuenta activa, para que el cliente sepa qué mostrar.
CREATE OR REPLACE FUNCTION fn_user_permissions(p_user integer)
RETURNS TABLE(codigo varchar) LANGUAGE sql STABLE AS $$
  SELECT p.codigo FROM tb_usuarios u
  JOIN tb_roles r ON r.rol = u.rol
  JOIN tb_rol_permisos rp ON rp.id_rol = r.id_rol
  JOIN tb_permisos p ON p.id_permiso = rp.id_permiso
  WHERE u.id_usuario = p_user AND u.estado = 'activo'
  ORDER BY p.codigo;
$$;

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

-- ============ Contenido editable ============

-- Indica si la cuenta activa tiene un permiso; las funciones de escritura lo repiten para
-- que la base rechace el cambio aunque la API fallara.
CREATE OR REPLACE FUNCTION fn_has_permission(p_user integer, p_permission text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM fn_authorized_user(p_user, p_permission));
$$;

CREATE OR REPLACE FUNCTION fn_texts_list()
RETURNS TABLE(clave varchar, valor text, actualizado_en timestamptz) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(t.clave, i.clave), COALESCE(t.valor, i.valor), t.actualizado_en
  FROM tb_textos_iniciales i FULL JOIN tb_textos t USING (clave) ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION fn_texts_initial()
RETURNS TABLE(clave varchar, valor text) LANGUAGE sql STABLE AS $$
  SELECT i.clave, i.valor FROM tb_textos_iniciales i ORDER BY i.clave;
$$;

-- ---------- Control de concurrencia del contenido ----------
-- La versión de cada unidad editable es el md5 de su estado (jsonb normaliza el orden de las
-- claves, así que el mismo contenido da siempre la misma versión). Cada guardado:
--   1) bloquea la unidad (pg_advisory_xact_lock) para que dos guardados no se crucen;
--   2) si el contenido ya es el que llega, responde 'sin_cambios' (repetir es seguro);
--   3) si la versión que trae no es la actual, responde 'conflicto' y no escribe;
--   4) si no, guarda y devuelve la versión nueva.

CREATE OR REPLACE FUNCTION fn_proposal_state(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('nombre', p.nombre, 'categoria', p.categoria, 'introduccion', p.introduccion,
    'kpis', COALESCE((SELECT jsonb_agg(jsonb_build_object('etiqueta', k.etiqueta, 'valor', k.valor) ORDER BY k.orden)
      FROM tb_propuesta_kpis k WHERE k.slug = p.slug), '[]'::jsonb))
  FROM tb_propuestas p WHERE p.slug = p_slug;
$$;

CREATE OR REPLACE FUNCTION fn_biography_state()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('anios', h.anios, 'titulo', h.titulo, 'texto', h.texto,
    'idMedio', h.id_medio, 'alt', h.alt) ORDER BY h.orden), '[]'::jsonb)
  FROM tb_biografia_hitos h;
$$;

CREATE OR REPLACE FUNCTION fn_work_state(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('nota', o.nota,
    'hitos', COALESCE((SELECT jsonb_agg(jsonb_build_object('nombre', h.nombre, 'completado', h.completado) ORDER BY h.orden)
      FROM tb_obra_hitos h WHERE h.slug = o.slug), '[]'::jsonb),
    'fotos', COALESCE((SELECT jsonb_agg(jsonb_build_object('idMedio', f.id_medio, 'pie', f.pie) ORDER BY f.orden)
      FROM tb_obra_fotos f WHERE f.slug = o.slug), '[]'::jsonb))
  FROM tb_obras o WHERE o.slug = p_slug;
$$;

CREATE OR REPLACE FUNCTION fn_chat_state()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('pregunta', c.pregunta, 'palabrasClave', c.palabras_clave,
    'respuesta', c.respuesta, 'enlaceTexto', c.enlace_texto, 'enlaceRuta', c.enlace_ruta, 'destacada', c.destacada)
    ORDER BY c.orden), '[]'::jsonb)
  FROM tb_chat_respuestas c;
$$;

-- Versiones vigentes de todo el borrador; el panel las envía de vuelta al guardar.
CREATE OR REPLACE FUNCTION fn_content_versions()
RETURNS TABLE(versiones jsonb) LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'textos', COALESCE((SELECT jsonb_object_agg(t.clave, md5(t.valor)) FROM tb_textos t), '{}'::jsonb),
    'propuestas', COALESCE((SELECT jsonb_object_agg(p.slug, md5(fn_proposal_state(p.slug)::text)) FROM tb_propuestas p), '{}'::jsonb),
    'biografia', md5(fn_biography_state()::text),
    'obras', COALESCE((SELECT jsonb_object_agg(o.slug, md5(fn_work_state(o.slug)::text)) FROM tb_obras o), '{}'::jsonb),
    'chat', md5(fn_chat_state()::text));
$$;

-- Guarda el borrador de un texto; con valor nulo lo borra y vuelve el texto por defecto.
-- Un texto sin cambiar no tiene versión (nula): quien lo edita por primera vez envía null.
DROP FUNCTION IF EXISTS fn_text_save(integer, text, text);
CREATE OR REPLACE FUNCTION fn_text_save(p_actor integer, p_key text, p_value text, p_version text)
RETURNS TABLE(resultado text, version text) LANGUAGE plpgsql AS $$
DECLARE v_current text; v_new text := md5(p_value);
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:texto:' || p_key));
  SELECT md5(t.valor) INTO v_current FROM tb_textos t WHERE t.clave = p_key;
  IF v_current IS NOT DISTINCT FROM v_new THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current IS DISTINCT FROM p_version THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  IF p_value IS NULL THEN
    DELETE FROM tb_textos t WHERE t.clave = p_key;
  ELSE
    INSERT INTO tb_textos (clave, valor, actualizado_por, actualizado_en)
    VALUES (p_key, p_value, p_actor, now())
    ON CONFLICT ON CONSTRAINT tb_textos_pkey DO UPDATE SET valor = EXCLUDED.valor,
      actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now();
  END IF;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, cambios)
  VALUES (p_actor, 'texto_guardado', 'tb_textos', jsonb_build_object('clave', p_key));
  RETURN QUERY SELECT 'guardado'::text, v_new;
END;
$$;

CREATE OR REPLACE FUNCTION fn_proposals_list()
RETURNS TABLE(slug varchar, nombre varchar, categoria varchar, introduccion varchar,
  kpis jsonb, actualizado_en timestamptz) LANGUAGE sql STABLE AS $$
  SELECT p.slug, p.nombre, p.categoria, p.introduccion,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('etiqueta', k.etiqueta, 'valor', k.valor) ORDER BY k.orden)
      FROM tb_propuesta_kpis k WHERE k.slug = p.slug), '[]'::jsonb),
    p.actualizado_en
  FROM tb_propuestas p ORDER BY p.orden;
$$;

-- Reemplaza datos y cifras de una propuesta en una sola transacción. Sin filas: no existe.
DROP FUNCTION IF EXISTS fn_proposal_save(integer, text, text, text, text, jsonb);
CREATE OR REPLACE FUNCTION fn_proposal_save(p_actor integer, p_slug text, p_name text,
  p_category text, p_intro text, p_kpis jsonb, p_version text)
RETURNS TABLE(resultado text, version text) LANGUAGE plpgsql AS $$
DECLARE v_current text; v_new text;
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:propuesta:' || p_slug));
  v_current := md5(fn_proposal_state(p_slug)::text);
  IF v_current IS NULL THEN RETURN; END IF;
  v_new := md5(jsonb_build_object('nombre', p_name, 'categoria', p_category, 'introduccion', p_intro,
    'kpis', p_kpis)::text);
  IF v_current = v_new THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current IS DISTINCT FROM p_version THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  UPDATE tb_propuestas p SET nombre = p_name, categoria = p_category, introduccion = p_intro,
    actualizado_por = p_actor, actualizado_en = now()
  WHERE p.slug = p_slug;
  DELETE FROM tb_propuesta_kpis k WHERE k.slug = p_slug;
  INSERT INTO tb_propuesta_kpis (slug, orden, etiqueta, valor)
  SELECT p_slug, e.orden, e.item->>'etiqueta', e.item->>'valor'
  FROM jsonb_array_elements(p_kpis) WITH ORDINALITY AS e(item, orden);
  INSERT INTO tb_auditoria (id_actor, accion, entidad, cambios)
  VALUES (p_actor, 'propuesta_guardada', 'tb_propuestas', jsonb_build_object('slug', p_slug));
  RETURN QUERY SELECT 'guardado'::text, v_new;
END;
$$;

-- Hitos de la biografía con su foto, si la tienen. Los anchos salen como jsonb: el driver de
-- Bun 1.3 se cae al leer columnas integer[].
DROP FUNCTION IF EXISTS fn_biography_list();
CREATE OR REPLACE FUNCTION fn_biography_list()
RETURNS TABLE(id_hito integer, anios varchar, titulo varchar, texto varchar, alt varchar,
  id_medio integer, medio_nombre varchar, medio_ancho integer, medio_alto integer, medio_anchos jsonb)
LANGUAGE sql STABLE AS $$
  SELECT h.id_hito, h.anios, h.titulo, h.texto, h.alt, m.id_medio, m.nombre, m.ancho, m.alto, to_jsonb(m.anchos)
  FROM tb_biografia_hitos h LEFT JOIN tb_medios m ON m.id_medio = h.id_medio
  ORDER BY h.orden;
$$;

-- Reemplaza la línea de tiempo completa: el panel guarda la lista tal como quedó, orden incluido.
DROP FUNCTION IF EXISTS fn_biography_save(integer, jsonb);
CREATE OR REPLACE FUNCTION fn_biography_save(p_actor integer, p_items jsonb, p_version text)
RETURNS TABLE(resultado text, version text) LANGUAGE plpgsql AS $$
DECLARE v_current text; v_new text := md5(p_items::text);
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:biografia'));
  v_current := md5(fn_biography_state()::text);
  IF v_current = v_new THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current IS DISTINCT FROM p_version THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  DELETE FROM tb_biografia_hitos;
  INSERT INTO tb_biografia_hitos (orden, anios, titulo, texto, id_medio, alt)
  SELECT e.orden, e.item->>'anios', e.item->>'titulo', e.item->>'texto',
    NULLIF(e.item->>'idMedio', '')::integer, NULLIF(e.item->>'alt', '')
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, orden);
  INSERT INTO tb_auditoria (id_actor, accion, entidad, cambios)
  VALUES (p_actor, 'biografia_guardada', 'tb_biografia_hitos',
    jsonb_build_object('hitos', jsonb_array_length(p_items)));
  RETURN QUERY SELECT 'guardado'::text, v_new;
END;
$$;

-- Obras con hitos y fotos agregados en JSON, en el orden de las propuestas.
CREATE OR REPLACE FUNCTION fn_works_list()
RETURNS TABLE(slug varchar, nota varchar, actualizado_en timestamptz, hitos jsonb, fotos jsonb)
LANGUAGE sql STABLE AS $$
  SELECT o.slug, o.nota, o.actualizado_en,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('nombre', h.nombre, 'completado', h.completado) ORDER BY h.orden)
      FROM tb_obra_hitos h WHERE h.slug = o.slug), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('idMedio', m.id_medio, 'nombre', m.nombre, 'ancho', m.ancho,
        'alto', m.alto, 'anchos', to_jsonb(m.anchos), 'pie', f.pie) ORDER BY f.orden)
      FROM tb_obra_fotos f JOIN tb_medios m ON m.id_medio = f.id_medio WHERE f.slug = o.slug), '[]'::jsonb)
  FROM tb_obras o JOIN tb_propuestas p ON p.slug = o.slug
  ORDER BY p.orden;
$$;

-- Reemplaza nota, hitos y fotos de una obra en una sola transacción. Sin filas: no existe.
DROP FUNCTION IF EXISTS fn_work_save(integer, text, text, jsonb, jsonb);
CREATE OR REPLACE FUNCTION fn_work_save(p_actor integer, p_slug text, p_note text,
  p_milestones jsonb, p_photos jsonb, p_version text)
RETURNS TABLE(resultado text, version text) LANGUAGE plpgsql AS $$
DECLARE v_current text; v_new text;
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:obra:' || p_slug));
  v_current := md5(fn_work_state(p_slug)::text);
  IF v_current IS NULL THEN RETURN; END IF;
  v_new := md5(jsonb_build_object('nota', p_note, 'hitos', p_milestones, 'fotos', p_photos)::text);
  IF v_current = v_new THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current IS DISTINCT FROM p_version THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  UPDATE tb_obras o SET nota = p_note, actualizado_por = p_actor, actualizado_en = now()
  WHERE o.slug = p_slug;
  DELETE FROM tb_obra_hitos h WHERE h.slug = p_slug;
  INSERT INTO tb_obra_hitos (slug, orden, nombre, completado)
  SELECT p_slug, e.orden, e.item->>'nombre', (e.item->>'completado')::boolean
  FROM jsonb_array_elements(p_milestones) WITH ORDINALITY AS e(item, orden);
  DELETE FROM tb_obra_fotos f WHERE f.slug = p_slug;
  INSERT INTO tb_obra_fotos (slug, orden, id_medio, pie)
  SELECT p_slug, e.orden, (e.item->>'idMedio')::integer, e.item->>'pie'
  FROM jsonb_array_elements(p_photos) WITH ORDINALITY AS e(item, orden);
  INSERT INTO tb_auditoria (id_actor, accion, entidad, cambios)
  VALUES (p_actor, 'obra_guardada', 'tb_obras', jsonb_build_object('slug', p_slug));
  RETURN QUERY SELECT 'guardado'::text, v_new;
END;
$$;

-- El driver de Bun 1.3 no maneja integer[]: se cae al enlazarlos como parámetro y al leerlos
-- en un resultado. Las listas de números entran como texto «1,2,3» y salen como jsonb.
DROP FUNCTION IF EXISTS fn_media_create(integer, text, integer, integer, integer[]);
DROP FUNCTION IF EXISTS fn_media_by_ids(integer[]);
DROP FUNCTION IF EXISTS fn_media_create(integer, text, integer, integer, jsonb);
DROP FUNCTION IF EXISTS fn_media_by_ids(jsonb);
DROP FUNCTION IF EXISTS fn_media_create(integer, text, integer, integer, text);
DROP FUNCTION IF EXISTS fn_media_by_ids(text);

-- Registra una foto ya procesada y guardada en disco. Si otra subida simultánea del mismo archivo
-- (mismo SHA-256) llegó antes, no inserta nada: el servicio usa la existente y borra sus archivos.
CREATE OR REPLACE FUNCTION fn_media_create(p_actor integer, p_name text, p_width integer,
  p_height integer, p_widths text, p_hash text)
RETURNS TABLE(id_medio integer, nombre varchar, ancho integer, alto integer, anchos jsonb)
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT fn_has_permission(p_actor, 'medios.subir') THEN RETURN; END IF;
  RETURN QUERY INSERT INTO tb_medios AS m (nombre, ancho, alto, anchos, creado_por, hash_contenido)
  VALUES (p_name, p_width, p_height, string_to_array(p_widths, ',')::integer[], p_actor, p_hash)
  ON CONFLICT ON CONSTRAINT uq_medios_hash_contenido DO NOTHING
  RETURNING m.id_medio, m.nombre, m.ancho, m.alto, to_jsonb(m.anchos);
END;
$$;

-- Foto ya subida con el mismo contenido: subirla otra vez (reintento, doble envío) la reutiliza.
CREATE OR REPLACE FUNCTION fn_media_by_hash(p_hash text)
RETURNS TABLE(id_medio integer, nombre varchar, ancho integer, alto integer, anchos jsonb)
LANGUAGE sql STABLE AS $$
  SELECT m.id_medio, m.nombre, m.ancho, m.alto, to_jsonb(m.anchos) FROM tb_medios m WHERE m.hash_contenido = p_hash;
$$;

-- Ids de las fotos que existen, para validar las que llegan en un guardado.
CREATE OR REPLACE FUNCTION fn_media_by_ids(p_ids text)
RETURNS TABLE(id_medio integer) LANGUAGE sql STABLE AS $$
  SELECT m.id_medio FROM tb_medios m
  WHERE m.id_medio = ANY(string_to_array(p_ids, ',')::integer[]);
$$;

-- ============ Publicaciones ============

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

-- ---------- Límite de intentos fallidos ----------
-- Una fila por clave: pareja correo+IP (`par:`, o `cambio:` al cambiar la contraseña) e IP (`ip:`).
-- Solo se cuentan fallos. Las esperas (1 min … 6 h) son para cualquiera, también el dueño que se
-- olvidó la contraseña. El tope, 3 días, es el «bloqueo mortal»: quien llega ahí se trata como atacante.
-- Si pasan 24 h sin fallar, el contador vuelve a cero (tras los 3 días se puede volver a intentar).

-- Estado de las claves pedidas (separadas por salto de línea): espera en segundos y fallos.
-- Un bloqueo vigente cuenta aunque su último fallo tenga más de 24 h (el mortal dura 3 días).
CREATE OR REPLACE FUNCTION fn_limit_check(p_keys text)
RETURNS TABLE(clave varchar, espera integer, fallos integer) LANGUAGE sql STABLE AS $$
  SELECT l.clave, GREATEST(0, ceil(extract(epoch FROM l.bloqueado_hasta - now())))::integer, l.fallos
  FROM tb_limites_intentos l
  WHERE l.clave = ANY(string_to_array(p_keys, chr(10)))
    AND (l.bloqueado_hasta > now() OR l.ultimo_fallo > now() - interval '24 hours');
$$;

-- Suma un fallo de forma atómica y aplica la escalada: `p_free` fallos sin espera; después
-- 1 min, 5 min, 15 min, 1 h y 6 h; el siguiente es el bloqueo mortal de 3 días. Devuelve la espera y los fallos.
CREATE OR REPLACE FUNCTION fn_limit_fail(p_key text, p_free integer)
RETURNS TABLE(espera integer, fallos integer) LANGUAGE plpgsql AS $$
DECLARE v_failures integer; v_wait integer;
BEGIN
  DELETE FROM tb_limites_intentos l WHERE l.ultimo_fallo < now() - interval '4 days'
    AND (l.bloqueado_hasta IS NULL OR l.bloqueado_hasta < now());
  INSERT INTO tb_limites_intentos AS l (clave, fallos, ultimo_fallo) VALUES (p_key, 1, now())
  ON CONFLICT (clave) DO UPDATE SET
    fallos = CASE WHEN l.ultimo_fallo < now() - interval '24 hours' THEN 1 ELSE l.fallos + 1 END,
    ultimo_fallo = now()
  RETURNING l.fallos INTO v_failures;
  v_wait := CASE WHEN v_failures <= p_free THEN 0
    ELSE COALESCE((ARRAY[60, 300, 900, 3600, 21600])[v_failures - p_free], 259200) END;
  UPDATE tb_limites_intentos l SET bloqueado_hasta = CASE WHEN v_wait > 0 THEN now() + make_interval(secs => v_wait) END
  WHERE l.clave = p_key;
  RETURN QUERY SELECT v_wait, v_failures;
END;
$$;

-- Bloqueo mortal de una IP: tras llegar al tope con un correo, esa IP no puede probar ningún otro.
-- No suma fallos: el contador propio de la IP (correos al azar) sigue aparte.
CREATE OR REPLACE FUNCTION fn_limit_block(p_key text, p_seconds integer)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO tb_limites_intentos AS l (clave, fallos, bloqueado_hasta, ultimo_fallo)
  VALUES (p_key, 0, now() + make_interval(secs => p_seconds), now())
  ON CONFLICT (clave) DO UPDATE SET
    bloqueado_hasta = GREATEST(COALESCE(l.bloqueado_hasta, now()), now() + make_interval(secs => p_seconds)),
    ultimo_fallo = now();
$$;

-- IPs distintas con bloqueo mortal vigente sobre un correo: con dos o más, ese correo sufre un
-- ataque desde varios sitios y el dueño termina de entrar con un enlace a su correo.
CREATE OR REPLACE FUNCTION fn_limit_attackers(p_email text)
RETURNS TABLE(total integer) LANGUAGE sql STABLE AS $$
  SELECT count(*)::integer FROM tb_limites_intentos l
  WHERE left(l.clave, length('par:' || p_email || '|')) = 'par:' || p_email || '|'
    -- La espera más larga antes del tope es de 6 h: solo el bloqueo mortal pasa de un día.
    AND l.bloqueado_hasta > now() + interval '1 day';
$$;

CREATE OR REPLACE FUNCTION fn_limit_clear(p_key text)
RETURNS void LANGUAGE sql AS $$
  DELETE FROM tb_limites_intentos WHERE clave = p_key;
$$;

-- Quien demuestra controlar el correo (restablece o usa el enlace de acceso) limpia las parejas de
-- ese correo. Las IPs con bloqueo mortal siguen bloqueadas: el atacante no vuelve a entrar por ahí.
CREATE OR REPLACE FUNCTION fn_limit_clear_email(p_email text)
RETURNS void LANGUAGE sql AS $$
  DELETE FROM tb_limites_intentos
  WHERE left(clave, length('par:' || p_email || '|')) = 'par:' || p_email || '|';
$$;

-- ============ Chat: preguntas frecuentes ============

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

-- Anota una pregunta sin respuesta (suma una vez más si ya estaba). Se limpian las que llevan
-- 90 días sin repetirse para que la tabla no crezca sin límite.
CREATE OR REPLACE FUNCTION fn_chat_unanswered_note(p_normalized text, p_example text)
RETURNS void LANGUAGE sql AS $$
  DELETE FROM tb_chat_sin_respuesta WHERE ultima_vez < now() - interval '90 days';
  INSERT INTO tb_chat_sin_respuesta (texto_normalizado, ejemplo) VALUES (p_normalized, p_example)
  ON CONFLICT (texto_normalizado) DO UPDATE SET veces = tb_chat_sin_respuesta.veces + 1, ultima_vez = now();
$$;

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

-- ============ Participación ciudadana: alertas y sugerencias ============
-- Crear es idempotente por (usuario, clave): repetir el envío devuelve la misma fila con
-- `nueva = false`. La base repite la comprobación del permiso aunque la API ya lo hiciera.

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

CREATE OR REPLACE FUNCTION fn_alerts_mine(p_user integer, p_limit integer)
RETURNS TABLE(id_alerta integer, tipo varchar, sector varchar, referencia varchar, descripcion varchar,
  foto varchar, estado varchar, creado_en timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT a.id_alerta, a.tipo, a.sector, a.referencia, a.descripcion, a.foto, a.estado, a.creado_en
  FROM tb_alertas a WHERE a.id_usuario = p_user ORDER BY a.id_alerta DESC LIMIT p_limit;
$$;

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

CREATE OR REPLACE FUNCTION fn_suggestions_mine(p_user integer, p_limit integer)
RETURNS TABLE(id_sugerencia integer, tema varchar, mensaje varchar, estado varchar, creado_en timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT s.id_sugerencia, s.tema, s.mensaje, s.estado, s.creado_en
  FROM tb_sugerencias s WHERE s.id_usuario = p_user ORDER BY s.id_sugerencia DESC LIMIT p_limit;
$$;

-- Lista del panel, por estado (nulo = todos), con el nombre y el correo de quien la envió.
CREATE OR REPLACE FUNCTION fn_alerts_list(p_actor integer, p_state text, p_limit integer, p_offset integer)
RETURNS TABLE(id_alerta integer, tipo varchar, sector varchar, referencia varchar, descripcion varchar,
  foto varchar, estado varchar, creado_en timestamptz, autor varchar, correo varchar)
LANGUAGE sql STABLE AS $$
  SELECT a.id_alerta, a.tipo, a.sector, a.referencia, a.descripcion, a.foto, a.estado, a.creado_en,
    u.nombres_completos, u.correo
  FROM tb_alertas a JOIN tb_usuarios u ON u.id_usuario = a.id_usuario
  WHERE fn_has_permission(p_actor, 'participacion.ver') AND (p_state IS NULL OR a.estado = p_state)
  ORDER BY a.id_alerta DESC LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION fn_suggestions_list(p_actor integer, p_state text, p_limit integer, p_offset integer)
RETURNS TABLE(id_sugerencia integer, tema varchar, mensaje varchar, estado varchar, creado_en timestamptz,
  autor varchar, correo varchar)
LANGUAGE sql STABLE AS $$
  SELECT s.id_sugerencia, s.tema, s.mensaje, s.estado, s.creado_en, u.nombres_completos, u.correo
  FROM tb_sugerencias s JOIN tb_usuarios u ON u.id_usuario = s.id_usuario
  WHERE fn_has_permission(p_actor, 'participacion.ver') AND (p_state IS NULL OR s.estado = p_state)
  ORDER BY s.id_sugerencia DESC LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION fn_participation_counts(p_actor integer)
RETURNS TABLE(tipo text, estado varchar, total integer) LANGUAGE sql STABLE AS $$
  SELECT 'alertas', a.estado, count(*)::integer FROM tb_alertas a
  WHERE fn_has_permission(p_actor, 'participacion.ver') GROUP BY a.estado
  UNION ALL
  SELECT 'sugerencias', s.estado, count(*)::integer FROM tb_sugerencias s
  WHERE fn_has_permission(p_actor, 'participacion.ver') GROUP BY s.estado;
$$;

-- Cambio de estado con control optimista: `p_expected` es el estado que veía el panel. Si ya
-- tiene el estado pedido, 'sin_cambios'; si otra persona lo cambió, 'conflicto' sin escribir.
CREATE OR REPLACE FUNCTION fn_alert_state_change(p_actor integer, p_id integer, p_state text, p_expected text)
RETURNS TABLE(resultado text, estado varchar) LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE v_current varchar;
BEGIN
  IF NOT fn_has_permission(p_actor, 'participacion.gestionar') THEN RETURN; END IF;
  SELECT a.estado INTO v_current FROM tb_alertas a WHERE a.id_alerta = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_current = p_state THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current <> p_expected THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  UPDATE tb_alertas a SET estado = p_state, actualizado_en = now(), actualizado_por = p_actor WHERE a.id_alerta = p_id;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
  VALUES (p_actor, 'alerta_estado', 'tb_alertas', p_id, jsonb_build_object('antes', v_current, 'despues', p_state));
  RETURN QUERY SELECT 'guardado'::text, p_state::varchar;
END;
$$;

CREATE OR REPLACE FUNCTION fn_suggestion_state_change(p_actor integer, p_id integer, p_state text, p_expected text)
RETURNS TABLE(resultado text, estado varchar) LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE v_current varchar;
BEGIN
  IF NOT fn_has_permission(p_actor, 'participacion.gestionar') THEN RETURN; END IF;
  SELECT s.estado INTO v_current FROM tb_sugerencias s WHERE s.id_sugerencia = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_current = p_state THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current <> p_expected THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  UPDATE tb_sugerencias s SET estado = p_state, actualizado_en = now(), actualizado_por = p_actor WHERE s.id_sugerencia = p_id;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
  VALUES (p_actor, 'sugerencia_estado', 'tb_sugerencias', p_id, jsonb_build_object('antes', v_current, 'despues', p_state));
  RETURN QUERY SELECT 'guardado'::text, p_state::varchar;
END;
$$;

-- La foto privada de una alerta solo la ve quien la envió o quien revisa la participación.
CREATE OR REPLACE FUNCTION fn_alert_photo_allowed(p_user integer, p_photo text)
RETURNS TABLE(permitido boolean) LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM tb_alertas a WHERE a.foto = p_photo
    AND (a.id_usuario = p_user OR fn_has_permission(p_user, 'participacion.ver')));
$$;
