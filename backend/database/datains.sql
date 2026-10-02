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
    ('cuenta.contrasenia.cambiar', 'Cambiar la contrasenia propia', ARRAY['votante', 'analista', 'coadmin', 'admin']::text[]),
    ('contenido.editar', 'Editar textos, propuestas, biografia y obras en borrador', ARRAY['coadmin', 'admin']::text[]),
    ('contenido.publicar', 'Publicar los borradores en el sitio', ARRAY['coadmin', 'admin']::text[]),
    ('medios.subir', 'Subir fotos de biografia y obras', ARRAY['coadmin', 'admin']::text[]),
    ('usuarios.ver', 'Consultar la lista de cuentas', ARRAY['admin']::text[]),
    ('usuarios.rol.cambiar', 'Cambiar el rol de otras cuentas segun la jerarquia', ARRAY['admin']::text[]),
    ('usuarios.estado.cambiar', 'Activar o desactivar otras cuentas segun la jerarquia', ARRAY['admin']::text[]),
    ('participacion.enviar', 'Enviar alertas, sugerencias y consultas al chat', ARRAY['votante', 'analista', 'coadmin', 'admin']::text[]),
    ('participacion.ver', 'Consultar las alertas y sugerencias recibidas', ARRAY['analista', 'coadmin', 'admin']::text[]),
    ('participacion.gestionar', 'Cambiar el estado de alertas y sugerencias', ARRAY['coadmin', 'admin']::text[])
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

-- Contenido inicial: solo se inserta si la tabla está vacía; después lo gestiona el panel.
INSERT INTO tb_propuestas (slug, nombre, categoria, introduccion, orden) VALUES
  ('agua-potable', 'Agua potable', 'Servicios básicos', 'Conoce este eje del plan para San Lorenzo.', 1),
  ('centro-de-alto-rendimiento', 'Centro de alto rendimiento', 'Deporte', 'Un espacio para conocer la propuesta deportiva.', 2),
  ('mercado-municipal', 'Mercado municipal', 'Comercio local', 'Consulta este eje sobre el comercio de la ciudad.', 3),
  ('terminal-terrestre', 'Terminal terrestre', 'Movilidad', 'Conoce la propuesta de transporte terrestre.', 4),
  ('agronomia', 'Agronomía', 'Campo y producción', 'Consulta el eje dedicado al sector agrícola.', 5),
  ('educacion', 'Educación', 'Aprendizaje', 'Conoce este eje del plan educativo.', 6),
  ('tecnologias-emergentes', 'Tecnologías emergentes', 'Innovación', 'Consulta la propuesta sobre nuevas tecnologías.', 7)
ON CONFLICT (slug) DO NOTHING;

-- Las cifras de «Centro de alto rendimiento» son provisionales: el cliente aún no las envió.
INSERT INTO tb_propuesta_kpis (slug, orden, etiqueta, valor)
SELECT v.* FROM (VALUES
  ('agua-potable', 1, 'Cobertura meta', '98%'),
  ('agua-potable', 2, 'Comunidades', '32'),
  ('agua-potable', 3, 'Plazo', '36 meses'),
  ('centro-de-alto-rendimiento', 1, 'Deportistas', '1,200'),
  ('centro-de-alto-rendimiento', 2, 'Disciplinas', '12'),
  ('centro-de-alto-rendimiento', 3, 'Plazo', '30 meses'),
  ('mercado-municipal', 1, 'Puestos', '420'),
  ('mercado-municipal', 2, 'Empleos', '+900'),
  ('mercado-municipal', 3, 'Plazo', '24 meses'),
  ('terminal-terrestre', 1, 'Pasajeros/día', '18,000'),
  ('terminal-terrestre', 2, 'Rutas', '26'),
  ('terminal-terrestre', 3, 'Plazo', '28 meses'),
  ('agronomia', 1, 'Productores', '2,500'),
  ('agronomia', 2, 'Hectáreas', '1,800'),
  ('agronomia', 3, 'Plazo', '24 meses'),
  ('educacion', 1, 'Estudiantes', '14,500'),
  ('educacion', 2, 'Centros', '38'),
  ('educacion', 3, 'Plazo', '36 meses'),
  ('tecnologias-emergentes', 1, 'Trámites digitales', '40+'),
  ('tecnologias-emergentes', 2, 'Puntos Wi-Fi', '60'),
  ('tecnologias-emergentes', 3, 'Plazo', '18 meses')
) AS v(slug, orden, etiqueta, valor)
WHERE NOT EXISTS (SELECT 1 FROM tb_propuesta_kpis);

INSERT INTO tb_biografia_hitos (orden, anios, titulo, texto)
SELECT v.* FROM (VALUES
  (1, '19XX', 'Sus raíces en San Lorenzo', 'Texto provisional. Aquí va dónde nace Carlos, quién es su familia y cómo fue crecer en el cantón.'),
  (2, '19XX', 'Formación', 'Texto provisional. Aquí van sus estudios y las personas que marcaron su forma de ver la comunidad.'),
  (3, '20XX', 'Primeros pasos en el trabajo', 'Texto provisional. Aquí va su oficio o profesión y cómo conoció de cerca los problemas de la ciudad.'),
  (4, '20XX', 'Servicio a la comunidad', 'Texto provisional. Aquí van las organizaciones, el voluntariado y las obras en barrios en las que participó.'),
  (5, '20XX', 'Llegada al Partido Social Cristiano', 'Texto provisional. Aquí va cuándo y por qué se une a la Lista 6.'),
  (6, '20XX', 'Candidato a la alcaldía de San Lorenzo', 'Texto provisional. Aquí va qué lo impulsa a postularse y qué propone para la ciudad.')
) AS v(orden, anios, titulo, texto)
WHERE NOT EXISTS (SELECT 1 FROM tb_biografia_hitos);

INSERT INTO tb_obras (slug, nota) VALUES
  ('agua-potable', 'Datos de ejemplo. Se tiende la red de distribución en los barrios del centro.'),
  ('centro-de-alto-rendimiento', 'Datos de ejemplo. Se revisan los estudios de suelo del terreno propuesto.'),
  ('mercado-municipal', 'Datos de ejemplo. La estructura principal está terminada; siguen instalaciones y puestos.'),
  ('terminal-terrestre', 'Datos de ejemplo. Se coordina con las cooperativas de transporte.'),
  ('agronomia', 'Datos de ejemplo. Los primeros grupos de productores reciben asistencia técnica.'),
  ('educacion', 'Datos de ejemplo. Aulas rehabilitadas y entregadas a la comunidad educativa.'),
  ('tecnologias-emergentes', 'Datos de ejemplo. Pendiente de aprobación del presupuesto.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tb_obra_hitos (slug, orden, nombre, completado)
SELECT v.* FROM (VALUES
  ('agua-potable', 1, 'Estudios y diseño', true),
  ('agua-potable', 2, 'Financiamiento', true),
  ('agua-potable', 3, 'Contratación', true),
  ('agua-potable', 4, 'Red de distribución', false),
  ('agua-potable', 5, 'Conexiones domiciliarias', false),
  ('centro-de-alto-rendimiento', 1, 'Selección del terreno', true),
  ('centro-de-alto-rendimiento', 2, 'Estudios técnicos', false),
  ('centro-de-alto-rendimiento', 3, 'Diseño definitivo', false),
  ('centro-de-alto-rendimiento', 4, 'Construcción', false),
  ('centro-de-alto-rendimiento', 5, 'Equipamiento', false),
  ('mercado-municipal', 1, 'Diseño', true),
  ('mercado-municipal', 2, 'Contratación', true),
  ('mercado-municipal', 3, 'Estructura', true),
  ('mercado-municipal', 4, 'Instalaciones', false),
  ('mercado-municipal', 5, 'Reubicación de comerciantes', false),
  ('terminal-terrestre', 1, 'Estudio de movilidad', true),
  ('terminal-terrestre', 2, 'Diseño', false),
  ('terminal-terrestre', 3, 'Financiamiento', false),
  ('terminal-terrestre', 4, 'Construcción', false),
  ('terminal-terrestre', 5, 'Puesta en servicio', false),
  ('agronomia', 1, 'Censo de productores', true),
  ('agronomia', 2, 'Convenios', true),
  ('agronomia', 3, 'Capacitaciones', false),
  ('agronomia', 4, 'Entrega de insumos', false),
  ('agronomia', 5, 'Evaluación', false),
  ('educacion', 1, 'Diagnóstico', true),
  ('educacion', 2, 'Diseño', true),
  ('educacion', 3, 'Rehabilitación', true),
  ('educacion', 4, 'Entrega', true),
  ('tecnologias-emergentes', 1, 'Presupuesto', false),
  ('tecnologias-emergentes', 2, 'Diseño', false),
  ('tecnologias-emergentes', 3, 'Instalación de paneles', false),
  ('tecnologias-emergentes', 4, 'Puesta en marcha', false)
) AS v(slug, orden, nombre, completado)
WHERE NOT EXISTS (SELECT 1 FROM tb_obra_hitos);

-- Preguntas frecuentes iniciales del chat (las mismas respuestas que tenía el sitio); solo si no hay ninguna.
INSERT INTO tb_chat_respuestas (orden, pregunta, palabras_clave, respuesta, enlace_texto, enlace_ruta, destacada)
SELECT v.* FROM (VALUES
  (1, 'Ver propuestas', 'propuesta, propuestas, plan, ejes, proyectos', 'Puedes revisar las siete propuestas para San Lorenzo en la sección de propuestas.', 'Ver propuestas', '/#propuestas', true),
  (2, 'Conocer a Carlos', 'carlos, astudillo, candidato, biografia, quien es', 'Conoce la historia y el camino de Carlos Astudillo.', 'Conocer a Carlos', '/acerca-de-nosotros/', true),
  (3, '¿Cómo reporto un daño en mi barrio?', 'reportar, reporto, dano, alerta, bache, basura, alumbrado, agua, barrio', 'Puedes enviar una alerta ciudadana con el tipo de problema, el sector y una foto.', 'Enviar una alerta', '/ciudadania/alerta-ciudadana/', true),
  (4, 'Contacto', 'contacto, contactar, whatsapp, facebook, tiktok, telefono, numero', 'Encuentra los canales de contacto de la campaña.', 'Ir a contacto', '/#contacto', true)
) AS v(orden, pregunta, palabras_clave, respuesta, enlace_texto, enlace_ruta, destacada)
WHERE NOT EXISTS (SELECT 1 FROM tb_chat_respuestas);
