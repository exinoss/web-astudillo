import { afterAll, beforeAll, expect, test } from 'bun:test';
import { readdir, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { avisoNoInsertable } from '../src/contracts/video';
import { diff } from '../src/content/services/content';
import { migrate } from '../src/db/migrate';
import { testApp } from './helpers';

const MEDIA = 'medios-pruebas-paginas';
const { sql, cookies, call, account, resetAccounts, draft, uploadPhoto } = testApp(MEDIA);
const ALCALDE = '/api/admin/contenido/acerca-de-carlos/por-que-quiero-ser-alcalde';
const CONOCE = '/api/admin/contenido/acerca-de-carlos/conoce-mas';
const REEL = 'https://www.facebook.com/reel/28327883403549284/';

const version = async (slug: string) => (await draft()).versiones.acercaDeCarlos[slug] as string;
/** Foto horizontal para la galería. */
const photo = (color: string, width = 1200, height = 800) => uploadPhoto(color, width, height);

const empty = { videos: [], entrevista: [], galeria: [] };
const VIDEO = { titulo: 'Te cuento mis razones', descripcion: null, enlace: REEL, vertical: true, idPortada: null };
const YOUTUBE = 'https://www.youtube.com/watch?v=abc12345678';

// Las plataformas de video responden simuladas, para no salir a internet; una prueba puede cambiar `plataforma`.
const REPRODUCTOR = '<body dir="ltr" class="plugin"><video src="video.mp4"></video></body>';
let plataforma = (url: string) => new Response(url.includes('/plugins/video.php') ? REPRODUCTOR : '{}');
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => plataforma(String(input instanceof Request ? input.url : input))) as typeof fetch;
afterAll(() => { globalThis.fetch = fetchReal; });

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

test('guardar normaliza los videos en su orden y repetir es seguro; subir una foto ya no crea la variante de tarjeta', async () => {
  const foto = await photo('#c0392b');
  const archivos = (await readdir(MEDIA)).filter(name => name.startsWith(foto.nombre));
  expect(archivos.length).toBeGreaterThan(0);
  expect(archivos.filter(name => name.includes('-tarjeta-'))).toEqual([]);
  const body = { videos: [{ ...VIDEO, descripcion: '  ', enlace: `${REEL}?mibextid=x` }, { ...VIDEO, titulo: 'Entrevista', enlace: YOUTUBE, vertical: false, idPortada: foto.idMedio }],
    entrevista: [], galeria: [], version: await version('por-que-quiero-ser-alcalde') };
  const first = await call(ALCALDE, 'PUT', body, cookies.coadmin);
  expect(first.status).toBe(200);
  const again = await call(ALCALDE, 'PUT', body, cookies.coadmin);
  expect(again.status).toBe(200);
  expect((await again.json()).version).toBe((await first.json()).version);
  const page = (await draft()).acercaDeCarlos['por-que-quiero-ser-alcalde'];
  expect(page.videos[0]).toEqual({ titulo: 'Te cuento mis razones', descripcion: null, enlace: REEL, vertical: true, portada: null });
  expect(page.videos[1]).toMatchObject({ titulo: 'Entrevista', vertical: false, portada: { idMedio: foto.idMedio } });
  expect((await readdir(MEDIA)).filter(name => name.endsWith('.tmp'))).toEqual([]);
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM tb_auditoria WHERE accion = 'pagina_acerca_de_carlos_guardada'`;
  expect(n).toBe(1);
});

test('dos personas guardando a la vez: una gana y la otra recibe 409 sin pisarla', async () => {
  const loaded = await version('conoce-mas');
  const save = (pregunta: string) => call(CONOCE, 'PUT', { ...empty, entrevista: [{ pregunta, respuesta: 'Respuesta.' }], version: loaded }, cookies.coadmin);
  const replies = await Promise.all([save('Respeto'), save('Coherencia')]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await replies.find(r => r.status === 409)!.json()).error).toContain('Otra persona');
  const winner = replies[0].status === 200 ? 'Respeto' : 'Coherencia';
  expect((await draft()).acercaDeCarlos['conoce-mas'].entrevista[0].pregunta).toBe(winner);
});

test('la página personal guarda entrevista y galería; la de motivaciones las rechaza, y ninguna admite retrato', async () => {
  const galeria = await photo('#16a085');
  const personal = { videos: [],
    entrevista: [{ pregunta: '¿Qué significa San Lorenzo para ti?', respuesta: 'Mi casa.\nY mi gente.' }],
    galeria: [{ idMedio: galeria.idMedio, alt: 'Caminata', pie: 'Caminata por el centro' }] };
  expect((await call(CONOCE, 'PUT', { ...personal, version: await version('conoce-mas') }, cookies.coadmin)).status).toBe(200);
  const page = (await draft()).acercaDeCarlos['conoce-mas'];
  expect(page.entrevista[0].respuesta).toBe('Mi casa.\nY mi gente.');
  expect((await call(ALCALDE, 'PUT', { ...personal, version: await version('por-que-quiero-ser-alcalde') }, cookies.coadmin)).status).toBe(422);
  expect((await call(CONOCE, 'PUT', { ...personal, retrato: null, version: await version('conoce-mas') }, cookies.coadmin)).status).toBe(422);
});

test('valida enlaces, permisos y páginas, y rechaza las tarjetas, que ya no se editan', async () => {
  const base = { ...empty, version: await version('por-que-quiero-ser-alcalde') };
  const put = (body: object, who = 'coadmin', path = ALCALDE) => call(path, 'PUT', { ...base, ...body }, cookies[who]);
  const video = (enlace: string) => ({ videos: [{ ...VIDEO, enlace }] });
  expect((await put(video('https://example.com/video'))).status).toBe(422);
  for (const enlace of ['https://localhost/video.mp4', 'https://192.168.1.1/video.mp4', 'https://[::1]/video.mp4']) {
    expect((await put(video(enlace))).status).toBe(422);
  }
  expect((await put(video('<iframe src="https://www.facebook.com/plugins/video.php"></iframe>'))).status).toBe(422);
  expect((await put({ tarjetas: [] })).status).toBe(422);
  expect((await put({ videos: Array.from({ length: 7 }, () => VIDEO) })).status).toBe(422);
  expect((await put({ galeria: [{ idMedio: 999999, alt: 'Foto', pie: 'Pie' }] }, 'coadmin', CONOCE)).status).toBe(422);
  expect((await put({ extra: true })).status).toBe(422);
  expect((await put({}, 'votante')).status).toBe(403);
  expect((await put({}, 'coadmin', '/api/admin/contenido/acerca-de-carlos/biografia')).status).toBe(404);
});

test('el texto breve del video conserva sus saltos de línea; el título no los admite', async () => {
  const descripcion = '¡YA BASTA! #SanLorenzo\r\n¡NO MÁS DE LO MISMO!\n¡NO AL CONTINUISMO!\n#LaNuevaHistoria #Unidos';
  const save = async (titulo: string) => call(ALCALDE, 'PUT', { ...empty,
    videos: [{ ...VIDEO, titulo, descripcion }], version: await version('por-que-quiero-ser-alcalde') }, cookies.coadmin);
  const rejected = await save('Mi mensaje\npara San Lorenzo');
  expect(rejected.status).toBe(422);
  expect((await rejected.json()).error).toBe('Video 1 · título: escribe el texto en una sola línea');
  expect((await save('Mi mensaje para San Lorenzo')).status).toBe(200);
  const page = (await draft()).acercaDeCarlos['por-que-quiero-ser-alcalde'];
  expect(page.videos[0].descripcion).toBe('¡YA BASTA! #SanLorenzo\n¡NO MÁS DE LO MISMO!\n¡NO AL CONTINUISMO!\n#LaNuevaHistoria #Unidos');
});

test('publicar congela las páginas y un snapshot anterior sin ellas no cuenta como cambio', async () => {
  const pending = await (await call('/api/admin/publicaciones/pendientes', 'GET', undefined, cookies.admin)).json();
  expect(pending.cambios).toContainEqual({ tipo: 'Página', descripcion: 'Por qué quiero ser alcalde' });
  expect((await call('/api/admin/publicaciones', 'POST', undefined, cookies.admin)).status).toBe(200);
  const [{ contenido }] = await sql`SELECT contenido FROM tb_publicaciones ORDER BY id_publicacion DESC LIMIT 1`;
  expect(contenido.acercaDeCarlos['por-que-quiero-ser-alcalde'].videos[0].enlace).toBe(REEL);
  const current = await (await call('/api/admin/contenido', 'GET', undefined, cookies.coadmin)).json();
  const emptyPages = { ...current, acercaDeCarlos: { 'por-que-quiero-ser-alcalde': empty, 'conoce-mas': empty } };
  const { acercaDeCarlos: _, ...older } = emptyPages;
  expect(diff(older, emptyPages).filter(c => c.tipo === 'Página')).toEqual([]);
  // Una publicación anterior trae tarjetas, retrato y un solo `video`.
  const vieja = { ...current, acercaDeCarlos: Object.fromEntries(Object.entries(current.acercaDeCarlos as Record<string, { videos: unknown[] }>).map(([s, { videos, ...p }]) => {
    expect(videos.length).toBeLessThanOrEqual(1);
    return [s, { tarjetas: [{ titulo: 'Vieja' }], retrato: null, video: videos[0] ?? null, ...p }];
  })) };
  expect(diff(vieja, current).filter(c => c.tipo === 'Página')).toEqual([]);
});


test('la portada del video se obtiene de su plataforma, solo de sus dominios, y repetirla no la duplica', async () => {
  const jpg = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#284e9c' } }).jpeg().toBuffer();
  const pedidas: string[] = [];
  const original = globalThis.fetch;
  let og = 'https://scontent.xx.fbcdn.net/v/portada.jpg?oe=1';
  let redirige = '';
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    pedidas.push(url);
    const respuesta = (body: BodyInit | null, status = 200) => Object.defineProperty(new Response(body, { status }), 'url', { value: redirige || url });
    if (url.includes('maxresdefault')) return respuesta(null, 404);
    if (url.startsWith('https://www.facebook.com/')) return respuesta(`<meta property="og:image" content="${og.replaceAll('&', '&amp;')}" />`);
    return respuesta(new Uint8Array(jpg));
  }) as typeof fetch;
  const portada = (enlace: string, cookie = cookies.coadmin) => call('/api/admin/medios/portada-video', 'POST', { enlace }, cookie);
  try {
    expect((await portada('https://youtu.be/abc12345678', '')).status).toBe(401);
    expect((await portada('https://youtu.be/abc12345678', cookies.votante)).status).toBe(403);
    const [a, b] = await Promise.all([portada('https://youtu.be/abc12345678'), portada('https://youtu.be/abc12345678')]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const foto = await a.json();
    expect((await b.json()).idMedio).toBe(foto.idMedio);
    expect(foto).toMatchObject({ ancho: 1280, alto: 720 });
    expect(pedidas.some(u => u.endsWith('/hqdefault.jpg'))).toBe(true);
    expect((await (await portada(REEL)).json()).idMedio).toBe(foto.idMedio);

    pedidas.length = 0;
    og = 'https://atacante.example/portada.jpg';
    expect((await portada(REEL)).status).toBe(422);
    expect(pedidas.some(u => u.includes('atacante.example'))).toBe(false);
    og = 'https://scontent.xx.fbcdn.net/v/portada.jpg';
    redirige = 'https://atacante.example/portada.jpg';
    expect((await portada(REEL)).status).toBe(422);
    redirige = '';
    expect((await portada('https://example.com/video.mp4')).status).toBe(422);
    expect((await portada('https://example.com/no-es-video')).status).toBe(422);
  } finally {
    globalThis.fetch = original;
  }
});

test('no guarda un video que su plataforma no deja mostrar; si no se puede comprobar, lo guarda', async () => {
  const inicial = await version('por-que-quiero-ser-alcalde');
  const put = (enlace: string, primero?: string) => call(ALCALDE, 'PUT',
    { ...empty, version: inicial, videos: [...(primero ? [{ ...VIDEO, enlace: primero }] : []), { ...VIDEO, enlace }] }, cookies.coadmin);
  const error = async (enlace: string) => { const r = await put(enlace); return [r.status, (await r.json()).error]; };
  const anterior = plataforma;
  try {
    plataforma = (url) => new Response(url.includes('/plugins/video.php') ? '<body dir="ltr" class="plugin"><div>No disponible</div></body>' : '{}');
    expect(await error(REEL)).toEqual([422, `Video 1: ${avisoNoInsertable('facebook', 'bloqueado')}`]);
    const segundo = await put(REEL, 'https://vimeo.com/123456789');
    expect((await segundo.json()).error).toBe(`Video 2: ${avisoNoInsertable('facebook', 'bloqueado')}`);
    plataforma = (url) => new Response('', { status: url.includes('youtube.com/oembed') ? 401 : 200 });
    expect(await error('https://youtu.be/abc12345678')).toEqual([422, `Video 1: ${avisoNoInsertable('youtube', 'bloqueado')}`]);
    plataforma = () => new Response('', { status: 404 });
    expect(await error('https://vimeo.com/123456789')).toEqual([422, `Video 1: ${avisoNoInsertable('vimeo', 'no-existe')}`]);
    expect(await version('por-que-quiero-ser-alcalde')).toBe(inicial);

    // Sin respuesta de la plataforma no se bloquea: no se pudo comprobar.
    plataforma = () => { throw new Error('sin red'); };
    expect((await put(REEL)).status).toBe(200);
  } finally {
    plataforma = anterior;
  }
});
