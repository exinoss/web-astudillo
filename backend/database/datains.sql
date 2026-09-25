-- Datos iniciales repetibles. Visitante es anonimo y no tiene fila de rol.
INSERT INTO tb_roles (rol, nombre, descripcion) VALUES
  ('votante', 'Votante', 'Cuenta ciudadana verificada'),
  ('analista', 'Analista', 'Rol interno'),
  ('coadmin', 'Coadmin', 'Rol interno'),
  ('admin', 'Admin', 'Rol interno')
ON CONFLICT (rol) DO NOTHING;

WITH permisos_iniciales(codigo, descripcion, roles) AS (
  VALUES
    ('perfil.ver', 'Consultar el perfil propio', ARRAY['votante', 'analista', 'coadmin', 'admin']::text[]),
    ('perfil.editar', 'Editar nombre y direccion propios', ARRAY['votante', 'analista', 'coadmin', 'admin']::text[]),
    ('cuenta.contrasenia.agregar', 'Agregar contrasenia tras reautenticacion Google', ARRAY['votante', 'analista', 'coadmin', 'admin']::text[]),
    ('cuenta.contrasenia.cambiar', 'Cambiar la contrasenia propia', ARRAY['votante', 'analista', 'coadmin', 'admin']::text[])
), permisos_guardados AS (
  INSERT INTO tb_permisos (codigo, descripcion)
  SELECT codigo, descripcion FROM permisos_iniciales
  ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion
  RETURNING id_permiso, codigo
)
INSERT INTO tb_rol_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM permisos_iniciales inicial
JOIN permisos_guardados p USING (codigo)
JOIN tb_roles r ON r.rol = ANY(inicial.roles)
ON CONFLICT DO NOTHING;
