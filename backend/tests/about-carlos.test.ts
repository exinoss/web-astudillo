import { afterAll, beforeAll, expect, test } from 'bun:test';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { diff } from '../src/content/services/content';
import { migrate } from '../src/db/migrate';
import { testApp } from './helpers';

const MEDIA = 'medios-pruebas-paginas';
const { sql, cookies, call, account, resetAccounts } = testApp(MEDIA);
const ALCALDE = '/api/admin/contenido/acerca-de-carlos/por-que-quiero-ser-alcalde';
const CONOCE = '/api/admin/contenido/acerca-de-carlos/conoce-mas';
const REEL = 'https://www.facebook.com/reel/28327883403549284/';

const draft = async () => (await call('/api/admin/contenido', 'GET', undefined, cookies.coadmin)).json();
const version = async (slug: string) => (await draft()).versiones.acercaDeCarlos[slug] as string;

async function photo(color: string, width = 1200, height = 800) {
  const form = new FormData();
  const buffer = await sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
  form.append('foto', new File([new Uint8Array(buffer)], 'foto.png'));
  return (await call('/api/admin/medios', 'POST', form, cookies.coadmin)).json() as Promise<{ idMedio: number; nombre: string }>;
}

const card = (idMedio: number, titulo = 'Escuchar a su gente') =>
  ({ idMedio, alt: 'Vecinos en una calle', titulo, texto: 'Conocer las necesidades de los barrios.', color: 'rojo', enfoque: { x: 50, y: 40 } });
const empty = { tarjetas: [], video: null, retrato: null, entrevista: [], galeria: [] };

beforeAll(async () => {
  await migrate(sql);
  // Vaciar las cuentas arrastra en cascada las publicaciones; migrar de nuevo vuelve a sembrar la inicial.
  await resetAccounts();
  await sql`TRUNCATE tb_acerca_de_carlos`;
  await migrate(sql);
  await account('admin', 'admin');
  await account('coadmin', 'coadmin');
  await account('votante', 'votante');
});
afterAll(async () => {
  await rm(MEDIA, { recursive: true, force: true }).catch(() => {});
  await sql.close();
});

test('sin contenido, las dos páginas están vacías y tienen versión', async () => {
  const c = await draft();
  expect(c.acercaDeCarlos).toEqual({ 'por-que-quiero-ser-alcalde': empty, 'conoce-mas': empty });
  expect(c.versiones.acercaDeCarlos['conoce-mas']).toMatch(/^[a-f0-9]{32}$/);
});

test('guardar normaliza el video, resuelve las fotos y prepara la variante de tarjeta; repetir es seguro', async () => {
  const foto = await photo('#c0392b');
  const body = { tarjetas: [card(foto.idMedio)], video: { titulo: 'Te cuento mis razones', descripcion: '  ', enlace: `${REEL}?mibextid=x`, vertical: true, idPortada: null },
    retrato: null, entrevista: [], galeria: [], version: await version('por-que-quiero-ser-alcalde') };
  const first = await call(ALCALDE, 'PUT', body, cookies.coadmin);
  expect(first.status).toBe(200);
  const again = await call(ALCALDE, 'PUT', body, cookies.coadmin);
  expect(again.status).toBe(200);
  expect((await again.json()).version).toBe((await first.json()).version);
  const page = (await draft()).acercaDeCarlos['por-que-quiero-ser-alcalde'];
  expect(page.video).toEqual({ titulo: 'Te cuento mis razones', descripcion: null, enlace: REEL, vertical: true, portada: null });
  expect(page.tarjetas[0]).toMatchObject({ titulo: 'Escuchar a su gente', color: 'rojo', enfoque: { x: 50, y: 40 }, foto: { idMedio: foto.idMedio } });
  const file = join(MEDIA, `${foto.nombre}-tarjeta-760.webp`);
  expect(await sharp(file).metadata()).toMatchObject({ format: 'webp', height: 760 });
  const [red, green, blue] = (await sharp(file).stats()).channels;
  expect([green.mean, blue.mean]).toEqual([red.mean, red.mean]);
  expect((await readdir(MEDIA)).filter(name => name.endsWith('.tmp'))).toEqual([]);
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM tb_auditoria WHERE accion = 'pagina_acerca_de_carlos_guardada'`;
  expect(n).toBe(1);
});

test('dos personas guardando a la vez: una gana y la otra recibe 409 sin pisarla', async () => {
  const foto = await photo('#2c3e50');
  const loaded = await version('conoce-mas');
  const save = (titulo: string) => call(CONOCE, 'PUT', { ...empty, tarjetas: [{ ...card(foto.idMedio, titulo), color: 'azul' }], version: loaded }, cookies.coadmin);
  const replies = await Promise.all([save('Respeto'), save('Coherencia')]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await replies.find(r => r.status === 409)!.json()).error).toContain('Otra persona');
  const winner = replies[0].status === 200 ? 'Respeto' : 'Coherencia';
  expect((await draft()).acercaDeCarlos['conoce-mas'].tarjetas[0].titulo).toBe(winner);
});

test('la página personal guarda retrato, entrevista y galería; la de motivaciones los rechaza', async () => {
  const [retrato, galeria] = await Promise.all([photo('#e67e22', 800, 1000), photo('#16a085')]);
  const personal = { tarjetas: [], video: null, retrato: { idMedio: retrato.idMedio, alt: 'Retrato de Carlos' },
    entrevista: [{ pregunta: '¿Qué significa San Lorenzo para ti?', respuesta: 'Mi casa.\nY mi gente.' }],
    galeria: [{ idMedio: galeria.idMedio, alt: 'Caminata', pie: 'Caminata por el centro' }] };
  expect((await call(CONOCE, 'PUT', { ...personal, version: await version('conoce-mas') }, cookies.coadmin)).status).toBe(200);
  const page = (await draft()).acercaDeCarlos['conoce-mas'];
  expect(page.retrato).toMatchObject({ alt: 'Retrato de Carlos', foto: { idMedio: retrato.idMedio } });
  expect(page.entrevista[0].respuesta).toBe('Mi casa.\nY mi gente.');
  expect((await call(ALCALDE, 'PUT', { ...personal, version: await version('por-que-quiero-ser-alcalde') }, cookies.coadmin)).status).toBe(422);
});

test('valida enlaces, textos, fotos, cantidades, permisos y páginas', async () => {
  const foto = await photo('#8e44ad');
  const base = { ...empty, version: await version('por-que-quiero-ser-alcalde') };
  const put = (body: object, who = 'coadmin', path = ALCALDE) => call(path, 'PUT', { ...base, ...body }, cookies[who]);
  const video = (enlace: string) => ({ video: { titulo: 'Video', descripcion: null, enlace, vertical: false, idPortada: null } });
  expect((await put(video('https://example.com/video'))).status).toBe(422);
  expect((await put(video('<iframe src="https://www.facebook.com/plugins/video.php"></iframe>'))).status).toBe(422);
  expect((await put({ tarjetas: [card(foto.idMedio, '<b>Hola</b>')] })).status).toBe(422);
  expect((await put({ tarjetas: [card(999999)] })).status).toBe(422);
  expect((await put({ tarjetas: [{ ...card(foto.idMedio), color: '#ff0000' }] })).status).toBe(422);
  expect((await put({ tarjetas: [{ ...card(foto.idMedio), enfoque: { x: 101, y: 0 } }] })).status).toBe(422);
  expect((await put({ tarjetas: Array.from({ length: 7 }, () => card(foto.idMedio)) })).status).toBe(422);
  expect((await put({ extra: true })).status).toBe(422);
  expect((await put({ tarjetas: [card(foto.idMedio)] }, 'votante')).status).toBe(403);
  expect((await put({}, 'coadmin', '/api/admin/contenido/acerca-de-carlos/biografia')).status).toBe(404);
});

test('publicar congela las páginas y un snapshot anterior sin ellas no cuenta como cambio', async () => {
  const pending = await (await call('/api/admin/publicaciones/pendientes', 'GET', undefined, cookies.admin)).json();
  expect(pending.cambios).toContainEqual({ tipo: 'Página', descripcion: 'Por qué quiero ser alcalde' });
  expect((await call('/api/admin/publicaciones', 'POST', undefined, cookies.admin)).status).toBe(200);
  const [{ contenido }] = await sql`SELECT contenido FROM tb_publicaciones ORDER BY id_publicacion DESC LIMIT 1`;
  expect(contenido.acercaDeCarlos['por-que-quiero-ser-alcalde'].video.enlace).toBe(REEL);
  const current = await (await call('/api/admin/contenido', 'GET', undefined, cookies.coadmin)).json();
  const emptyPages = { ...current, acercaDeCarlos: { 'por-que-quiero-ser-alcalde': empty, 'conoce-mas': empty } };
  const { acercaDeCarlos: _, ...older } = emptyPages;
  expect(diff(older, emptyPages).filter(c => c.tipo === 'Página')).toEqual([]);
});

