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

-- Sin contraseña (cuenta solo con Google), `contrasenia_hash` llega nulo y la identidad se confirma con un código.
CREATE OR REPLACE FUNCTION fn_confirmation_method(p_user integer)
RETURNS TABLE(correo varchar(320), contrasenia_hash text) LANGUAGE sql STABLE AS $$
  SELECT u.correo, i.contrasenia_hash FROM tb_usuarios u
  LEFT JOIN tb_identidades_autenticacion i ON i.id_usuario = u.id_usuario AND i.proveedor = 'correo'
  WHERE u.id_usuario = p_user AND u.estado = 'activo';
$$;

CREATE OR REPLACE FUNCTION fn_confirmation_code(p_user integer)
RETURNS TABLE(token_hash text) LANGUAGE sql STABLE AS $$
  SELECT t.token_hash FROM tb_token_autenticacion t
  WHERE t.id_usuario = p_user AND t.proposito = 'confirmar_accion'
    AND t.consumido_en IS NULL AND t.expira_en > now()
  ORDER BY t.creado_en DESC LIMIT 1;
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
