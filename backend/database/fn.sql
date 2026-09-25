-- Funciones de datos de la API. SECURITY INVOKER conserva los privilegios del rol SQL.
-- Ninguna funcion recibe SQL dinamico ni confia en un rol enviado por el cliente.

-- Elimina tokens de autenticación vencidos.
CREATE OR REPLACE FUNCTION fn_cleanup_tokens() RETURNS void LANGUAGE sql AS $$
  DELETE FROM tb_token_autenticacion WHERE expira_en < now();
$$;

-- Busca una cuenta por correo normalizado.
CREATE OR REPLACE FUNCTION fn_user_by_email(p_email text)
RETURNS SETOF tb_usuarios LANGUAGE sql STABLE AS $$
  SELECT * FROM tb_usuarios WHERE lower(correo) = p_email;
$$;

-- Busca y bloquea la cuenta por correo durante una transacción.
CREATE OR REPLACE FUNCTION fn_user_by_email_locked(p_email text)
RETURNS SETOF tb_usuarios LANGUAGE sql VOLATILE AS $$
  SELECT * FROM tb_usuarios WHERE lower(correo) = p_email FOR UPDATE;
$$;

-- Devuelve una cuenta solo si está activa.
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

-- Guarda datos temporales y hashes para un alta aún no verificada.
CREATE OR REPLACE FUNCTION fn_pending_create(
  p_email text, p_token_hash text, p_name text, p_address text,
  p_password_hash text, p_browser_hash text
) RETURNS TABLE(id_token_autenticacion integer) LANGUAGE plpgsql AS $$
DECLARE v_id integer;
BEGIN
  INSERT INTO tb_token_autenticacion (correo, proposito, token_hash, expira_en)
  VALUES (p_email, 'registro_correo', p_token_hash, now() + interval '30 minutes')
  RETURNING tb_token_autenticacion.id_token_autenticacion INTO v_id;
  INSERT INTO tb_registros_pendientes
    (id_token_autenticacion, nombres_completos, direccion, contrasenia_hash,
     verificador_navegador_hash)
  VALUES (v_id, p_name, p_address, p_password_hash, p_browser_hash);
  RETURN QUERY SELECT v_id;
END;
$$;

-- Lee y bloquea una solicitud de registro pendiente por hash de token.
CREATE OR REPLACE FUNCTION fn_pending_get(p_hash text)
RETURNS TABLE(
  id_token_autenticacion integer, correo varchar(320), expira_en timestamptz,
  consumido_en timestamptz, nombres_completos varchar(200), direccion text,
  contrasenia_hash text, verificador_navegador_hash text
) LANGUAGE sql VOLATILE AS $$
  SELECT t.id_token_autenticacion, t.correo, t.expira_en, t.consumido_en,
    p.nombres_completos, p.direccion, p.contrasenia_hash, p.verificador_navegador_hash
  FROM tb_token_autenticacion t JOIN tb_registros_pendientes p
    ON p.id_token_autenticacion = t.id_token_autenticacion
  WHERE t.token_hash = p_hash AND t.proposito = 'registro_correo'
  FOR UPDATE OF t;
$$;

-- Crea usuario e identidad de correo y consume el registro pendiente.
CREATE OR REPLACE FUNCTION fn_registration_complete(p_token integer)
RETURNS TABLE(id_usuario integer) LANGUAGE plpgsql AS $$
DECLARE v_token record; v_user integer;
BEGIN
  SELECT t.correo, p.nombres_completos, p.direccion, p.contrasenia_hash
  INTO v_token FROM tb_token_autenticacion t JOIN tb_registros_pendientes p
    ON p.id_token_autenticacion = t.id_token_autenticacion
  WHERE t.id_token_autenticacion = p_token AND t.proposito = 'registro_correo'
    AND t.consumido_en IS NULL AND t.expira_en > now()
  FOR UPDATE OF t;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO tb_usuarios (correo, nombres_completos, direccion, correo_verificado_en)
  VALUES (v_token.correo, v_token.nombres_completos, v_token.direccion, now())
  RETURNING tb_usuarios.id_usuario INTO v_user;
  INSERT INTO tb_identidades_autenticacion (id_usuario, proveedor, contrasenia_hash)
  VALUES (v_user, 'correo', v_token.contrasenia_hash);
  UPDATE tb_token_autenticacion SET consumido_en = now() WHERE id_token_autenticacion = p_token;
  DELETE FROM tb_registros_pendientes WHERE id_token_autenticacion = p_token;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro)
  VALUES (v_user, 'cuenta_creada', 'tb_usuarios', v_user);
  RETURN QUERY SELECT v_user;
END;
$$;

-- Busca el usuario vinculado al identificador estable de Google.
CREATE OR REPLACE FUNCTION fn_google_user(p_sub text)
RETURNS SETOF tb_usuarios LANGUAGE sql STABLE AS $$
  SELECT u.* FROM tb_identidades_autenticacion i
  JOIN tb_usuarios u ON u.id_usuario = i.id_usuario
  WHERE i.proveedor = 'google' AND i.sujeto_externo = p_sub;
$$;

-- Crea una cuenta Google si el correo todavía no está registrado.
CREATE OR REPLACE FUNCTION fn_google_user_create(p_email text, p_name text)
RETURNS SETOF tb_usuarios LANGUAGE sql VOLATILE AS $$
  INSERT INTO tb_usuarios (correo, nombres_completos, correo_verificado_en)
  VALUES (p_email, p_name, now()) ON CONFLICT DO NOTHING RETURNING *;
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

-- Devuelve el usuario propietario de un sub de Google.
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

-- Crea un token temporal con propósito, vencimiento y verificadores opcionales.
CREATE OR REPLACE FUNCTION fn_auth_token_create(
  p_user integer, p_email text, p_purpose text, p_sub text,
  p_hash text, p_browser_hash text, p_seconds integer
) RETURNS TABLE(id_token_autenticacion integer) LANGUAGE sql AS $$
  INSERT INTO tb_token_autenticacion
    (id_usuario, correo, proposito, sujeto_externo, token_hash,
     verificador_navegador_hash, expira_en)
  VALUES (p_user, p_email, p_purpose, p_sub, p_hash, p_browser_hash,
    now() + make_interval(secs => p_seconds))
  RETURNING tb_token_autenticacion.id_token_autenticacion;
$$;

-- Busca y bloquea un token por hash y propósito.
CREATE OR REPLACE FUNCTION fn_auth_token_get(p_hash text, p_purpose text)
RETURNS SETOF tb_token_autenticacion LANGUAGE sql VOLATILE AS $$
  SELECT * FROM tb_token_autenticacion
  WHERE token_hash = p_hash AND proposito = p_purpose FOR UPDATE;
$$;

-- Busca y bloquea tokens temporales de registro o vínculo Google.
CREATE OR REPLACE FUNCTION fn_google_token_get(p_hash text)
RETURNS SETOF tb_token_autenticacion LANGUAGE sql VOLATILE AS $$
  SELECT * FROM tb_token_autenticacion
  WHERE token_hash = p_hash AND proposito IN ('registro_google', 'vincular_google')
  FOR UPDATE;
$$;

-- Marca un token como usado y elimina su verificador de navegador.
CREATE OR REPLACE FUNCTION fn_auth_token_consume(p_token integer)
RETURNS void LANGUAGE sql AS $$
  UPDATE tb_token_autenticacion
  SET consumido_en = now(), verificador_navegador_hash = NULL
  WHERE id_token_autenticacion = p_token AND consumido_en IS NULL;
$$;

-- Borra el token temporal cuando no pudo enviarse su correo.
CREATE OR REPLACE FUNCTION fn_auth_token_delete(p_token integer)
RETURNS void LANGUAGE sql AS $$
  DELETE FROM tb_token_autenticacion WHERE id_token_autenticacion = p_token;
$$;

-- Obtiene credenciales de una cuenta con identidad de correo.
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

-- Rota el hash de renovación de una sesión activa.
CREATE OR REPLACE FUNCTION fn_session_rotate(p_old_hash text, p_new_hash text)
RETURNS SETOF tb_usuarios LANGUAGE plpgsql AS $$
DECLARE v_user tb_usuarios%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user FROM tb_sesiones s
  JOIN tb_usuarios u ON u.id_usuario = s.id_usuario
  WHERE s.token_hash = p_old_hash AND s.revocado_en IS NULL
    AND s.expira_en > now() AND u.estado = 'activo' FOR UPDATE OF s;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE tb_sesiones SET token_hash = p_new_hash,
    expira_en = now() + interval '7 days', ultimo_uso_en = now()
  WHERE token_hash = p_old_hash;
  RETURN NEXT v_user;
END;
$$;

-- Revoca una sesión mediante el hash de su refresh token.
CREATE OR REPLACE FUNCTION fn_session_revoke(p_hash text)
RETURNS void LANGUAGE sql AS $$
  UPDATE tb_sesiones SET revocado_en = now()
  WHERE token_hash = p_hash AND revocado_en IS NULL;
$$;

-- Actualiza nombre y dirección si la cuenta activa tiene permiso de edición.
CREATE OR REPLACE FUNCTION fn_profile_update(p_user integer, p_name text, p_address text)
RETURNS SETOF tb_usuarios LANGUAGE plpgsql AS $$
DECLARE v_user tb_usuarios%ROWTYPE;
BEGIN
  UPDATE tb_usuarios u SET nombres_completos = p_name, direccion = p_address,
    actualizado_en = now()
  WHERE u.id_usuario = p_user AND u.estado = 'activo' AND EXISTS (
    SELECT 1 FROM tb_roles r JOIN tb_rol_permisos rp ON rp.id_rol = r.id_rol
    JOIN tb_permisos p ON p.id_permiso = rp.id_permiso
    WHERE r.rol = u.rol AND p.codigo = 'perfil.editar'
  ) RETURNING u.* INTO v_user;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO tb_auditoria (id_actor, accion, entidad, id_registro, cambios)
  VALUES (p_user, 'perfil_actualizado', 'tb_usuarios', p_user,
    '{"campos":["nombres_completos","direccion"]}'::jsonb);
  RETURN NEXT v_user;
END;
$$;
