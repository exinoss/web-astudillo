import type { SQL } from 'bun';
import initial from '../../database/contenido-inicial.json';

export async function seedContent(sql: Pick<SQL, 'unsafe'>) {
  await sql.unsafe(`SELECT pg_advisory_xact_lock(hashtext('contenido:semilla'))`);
  const data = initial;
  await sql.unsafe(`INSERT INTO tb_textos_iniciales (clave, valor)
    SELECT key, value FROM jsonb_each_text($1::jsonb->'textos') ON CONFLICT DO NOTHING`, [data]);
  await sql.unsafe(`INSERT INTO tb_propuestas (slug, nombre, categoria, introduccion, orden)
    SELECT p->>'slug', p->>'nombre', p->>'categoria', p->>'introduccion', n
    FROM jsonb_array_elements($1::jsonb->'propuestas') WITH ORDINALITY AS v(p,n)
    ON CONFLICT DO NOTHING`, [data]);
  await sql.unsafe(`INSERT INTO tb_propuesta_kpis (slug, orden, etiqueta, valor)
    SELECT p->>'slug', n, k->>'etiqueta', k->>'valor'
    FROM jsonb_array_elements($1::jsonb->'propuestas') p,
      jsonb_array_elements(p->'kpis') WITH ORDINALITY AS v(k,n)
    WHERE NOT EXISTS (SELECT 1 FROM tb_propuesta_kpis)`, [data]);
  await sql.unsafe(`INSERT INTO tb_biografia_hitos (orden, anios, titulo, texto)
    SELECT n, h->>'anios', h->>'titulo', h->>'texto'
    FROM jsonb_array_elements($1::jsonb->'biografia') WITH ORDINALITY AS v(h,n)
    WHERE NOT EXISTS (SELECT 1 FROM tb_biografia_hitos)`, [data]);
  await sql.unsafe(`INSERT INTO tb_obras (slug, nota, actualizado_en)
    SELECT o->>'slug', o->>'nota', (o->>'actualizadoEn')::timestamptz
    FROM jsonb_array_elements($1::jsonb->'obras') o ON CONFLICT DO NOTHING`, [data]);
  await sql.unsafe(`INSERT INTO tb_obra_hitos (slug, orden, nombre, completado)
    SELECT o->>'slug', n, h->>'nombre', (h->>'completado')::boolean
    FROM jsonb_array_elements($1::jsonb->'obras') o,
      jsonb_array_elements(o->'hitos') WITH ORDINALITY AS v(h,n)
    WHERE NOT EXISTS (SELECT 1 FROM tb_obra_hitos)`, [data]);
  await sql.unsafe(`INSERT INTO tb_chat_respuestas
    (orden, pregunta, palabras_clave, respuesta, enlace_texto, enlace_ruta, destacada)
    SELECT n, c->>'pregunta', c->>'palabrasClave', c->>'respuesta',
      c->>'enlaceTexto', c->>'enlaceRuta', (c->>'destacada')::boolean
    FROM jsonb_array_elements($1::jsonb->'chat') WITH ORDINALITY AS v(c,n)
    WHERE NOT EXISTS (SELECT 1 FROM tb_chat_respuestas)`, [data]);
  // La primera vista pública queda congelada; nunca se exponen los borradores como respaldo.
  await sql.unsafe(`INSERT INTO tb_publicaciones (contenido, estado, terminado_en)
    SELECT $1::jsonb, 'publicada', now() WHERE NOT EXISTS (SELECT 1 FROM tb_publicaciones)`, [data]);
}
