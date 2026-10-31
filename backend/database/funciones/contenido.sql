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

CREATE OR REPLACE FUNCTION fn_about_carlos_state(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_slug IN ('por-que-quiero-ser-alcalde', 'conoce-mas') THEN COALESCE(
    (SELECT p.contenido FROM tb_acerca_de_carlos p WHERE p.slug = p_slug),
    '{"tarjetas": [], "video": null, "retrato": null, "entrevista": [], "galeria": []}'::jsonb) END;
$$;

CREATE OR REPLACE FUNCTION fn_about_carlos_list()
RETURNS TABLE(slug text, contenido jsonb) LANGUAGE sql STABLE AS $$
  SELECT s.slug, fn_about_carlos_state(s.slug)
  FROM (VALUES ('por-que-quiero-ser-alcalde', 1), ('conoce-mas', 2)) AS s(slug, orden) ORDER BY s.orden;
$$;

-- Sin filas: la página no existe.
CREATE OR REPLACE FUNCTION fn_about_carlos_save(p_actor integer, p_slug text, p_content jsonb, p_version text)
RETURNS TABLE(resultado text, version text) LANGUAGE plpgsql AS $$
DECLARE v_current text; v_new text := md5(p_content::text);
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:pagina:' || p_slug));
  v_current := md5(fn_about_carlos_state(p_slug)::text);
  IF v_current IS NULL THEN RETURN; END IF;
  IF v_current = v_new THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current IS DISTINCT FROM p_version THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  INSERT INTO tb_acerca_de_carlos (slug, contenido, actualizado_por, actualizado_en)
  VALUES (p_slug, p_content, p_actor, now())
  ON CONFLICT ON CONSTRAINT tb_acerca_de_carlos_pkey DO UPDATE SET contenido = EXCLUDED.contenido,
    actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now();
  INSERT INTO tb_auditoria (id_actor, accion, entidad, cambios)
  VALUES (p_actor, 'pagina_acerca_de_carlos_guardada', 'tb_acerca_de_carlos', jsonb_build_object('slug', p_slug));
  RETURN QUERY SELECT 'guardado'::text, v_new;
END;
$$;

CREATE OR REPLACE FUNCTION fn_my_team_list()
RETURNS TABLE(clave varchar, contenido jsonb) LANGUAGE sql STABLE AS $$
  SELECT m.clave, m.contenido FROM tb_mi_equipo m ORDER BY m.clave;
$$;

-- Como los textos: una parte que nunca se guardó no tiene versión (nula) y quien la edita primero envía null.
-- Una clave que no existe la rechaza la restricción ck_mi_equipo_clave.
CREATE OR REPLACE FUNCTION fn_my_team_save(p_actor integer, p_key text, p_content jsonb, p_version text)
RETURNS TABLE(resultado text, version text) LANGUAGE plpgsql AS $$
DECLARE v_current text; v_new text := md5(p_content::text);
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:mi-equipo:' || p_key));
  SELECT md5(m.contenido::text) INTO v_current FROM tb_mi_equipo m WHERE m.clave = p_key;
  IF v_current IS NOT DISTINCT FROM v_new THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current IS DISTINCT FROM p_version THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  INSERT INTO tb_mi_equipo (clave, contenido, actualizado_por, actualizado_en)
  VALUES (p_key, p_content, p_actor, now())
  ON CONFLICT ON CONSTRAINT tb_mi_equipo_pkey DO UPDATE SET contenido = EXCLUDED.contenido,
    actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now();
  INSERT INTO tb_auditoria (id_actor, accion, entidad, cambios)
  VALUES (p_actor, 'mi_equipo_guardado', 'tb_mi_equipo', jsonb_build_object('clave', p_key));
  RETURN QUERY SELECT 'guardado'::text, v_new;
END;
$$;

CREATE OR REPLACE FUNCTION fn_home_carousels_list()
RETURNS TABLE(clave varchar, contenido jsonb) LANGUAGE sql STABLE AS $$
  SELECT c.clave, c.contenido FROM tb_inicio_carruseles c ORDER BY c.clave;
$$;

-- Como en «Mi equipo»; la semilla crea las dos filas, pero un carrusel sin fila se guarda enviando versión nula.
-- Una clave que no existe la rechaza la restricción ck_inicio_carruseles_clave.
CREATE OR REPLACE FUNCTION fn_home_carousels_save(p_actor integer, p_key text, p_content jsonb, p_version text)
RETURNS TABLE(resultado text, version text) LANGUAGE plpgsql AS $$
DECLARE v_current text; v_new text := md5(p_content::text);
BEGIN
  IF NOT fn_has_permission(p_actor, 'contenido.editar') THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('contenido:inicio:' || p_key));
  SELECT md5(c.contenido::text) INTO v_current FROM tb_inicio_carruseles c WHERE c.clave = p_key;
  IF v_current IS NOT DISTINCT FROM v_new THEN RETURN QUERY SELECT 'sin_cambios'::text, v_current; RETURN; END IF;
  IF v_current IS DISTINCT FROM p_version THEN RETURN QUERY SELECT 'conflicto'::text, v_current; RETURN; END IF;
  INSERT INTO tb_inicio_carruseles (clave, contenido, actualizado_por, actualizado_en)
  VALUES (p_key, p_content, p_actor, now())
  ON CONFLICT ON CONSTRAINT tb_inicio_carruseles_pkey DO UPDATE SET contenido = EXCLUDED.contenido,
    actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now();
  INSERT INTO tb_auditoria (id_actor, accion, entidad, cambios)
  VALUES (p_actor, 'carrusel_inicio_guardado', 'tb_inicio_carruseles', jsonb_build_object('clave', p_key));
  RETURN QUERY SELECT 'guardado'::text, v_new;
END;
$$;

-- Versiones vigentes de todo el borrador; el panel las envía de vuelta al guardar.
CREATE OR REPLACE FUNCTION fn_content_versions()
RETURNS TABLE(versiones jsonb) LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'textos', COALESCE((SELECT jsonb_object_agg(t.clave, md5(t.valor)) FROM tb_textos t), '{}'::jsonb),
    'propuestas', COALESCE((SELECT jsonb_object_agg(p.slug, md5(fn_proposal_state(p.slug)::text)) FROM tb_propuestas p), '{}'::jsonb),
    'biografia', md5(fn_biography_state()::text),
    'obras', COALESCE((SELECT jsonb_object_agg(o.slug, md5(fn_work_state(o.slug)::text)) FROM tb_obras o), '{}'::jsonb),
    'chat', md5(fn_chat_state()::text),
    'acercaDeCarlos', (SELECT jsonb_object_agg(l.slug, md5(l.contenido::text)) FROM fn_about_carlos_list() l),
    'miEquipo', COALESCE((SELECT jsonb_object_agg(m.clave, md5(m.contenido::text)) FROM fn_my_team_list() m), '{}'::jsonb),
    'inicio', COALESCE((SELECT jsonb_object_agg(c.clave, md5(c.contenido::text)) FROM fn_home_carousels_list() c), '{}'::jsonb));
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

CREATE OR REPLACE FUNCTION fn_media_details(p_ids text)
RETURNS TABLE(id_medio integer, nombre varchar, ancho integer, alto integer, anchos jsonb)
LANGUAGE sql STABLE AS $$
  SELECT m.id_medio, m.nombre, m.ancho, m.alto, to_jsonb(m.anchos) FROM tb_medios m
  WHERE m.id_medio = ANY(string_to_array(p_ids, ',')::integer[]);
$$;
