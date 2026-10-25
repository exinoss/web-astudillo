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
