import { afterAll, beforeAll, expect, test } from 'bun:test';
import { VERSION_LEGAL } from '../src/contracts/legal';
import { avisoNoInsertable } from '../src/contracts/video';
import { callPg } from '../src/db/call';
import { migrate } from '../src/db/migrate';
import { testApp } from './helpers';

const { sql, ids, cookies, call, account, resetAccounts } = testApp('medios-pruebas-avisos');
const ALCALDE = '/api/admin/contenido/acerca-de-carlos/por-que-quiero-ser-alcalde';
const REEL = 'https://www.facebook.com/reel/4119395378341161/';
const OTRO = 'https://www.facebook.com/reel/2128931004663209/';

// Facebook responde simulado: con `bloqueado` su reproductor llega sin video; con `sinRed`, la petición falla.
let bloqueado = false;
let sinRed = false;
let consultas = 0;
const fetchReal = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request) => {
  consultas++;
  if (sinRed) throw new Error('sin red');
  const url = String(input instanceof Request ? input.url : input);
  if (!url.includes('/plugins/video.php')) return new Response('{}');
  return new Response(`<body dir="ltr" class="plugin">${bloqueado ? '' : '<video src="video.mp4"></video>'}</body>`);
}) as typeof fetch;

const avisos = async (cookie = cookies.admin) => (await (await call('/api/admin/avisos', 'GET', undefined, cookie)).json()).avisos;
const version = async () => (await (await call('/api/admin/contenido', 'GET', undefined, cookies.admin)).json()).versiones.acercaDeCarlos['por-que-quiero-ser-alcalde'];
const guardarVideo = async (enlace: string) => call(ALCALDE, 'PUT', { tarjetas: [], retrato: null, entrevista: [], galeria: [],
  video: { titulo: 'Te cuento mis razones', descripcion: null, enlace, vertical: true, idPortada: null }, version: await version() }, cookies.admin);
/** Publica el borrador y da la publicación por terminada, como el publicador. */
async function publicar() {
  const res = await call('/api/admin/publicaciones', 'POST', undefined, cookies.admin);
  if (res.status !== 200) return res;
  const [claimed] = await callPg<{ id_publicacion: number }>(sql, 'publicationClaim');
  await callPg(sql, 'publicationFinish', [claimed.id_publicacion, true, null]);
  return res;
}
const publicaciones = async () => (await sql`SELECT count(*)::int AS n FROM tb_publicaciones`)[0].n as number;

beforeAll(async () => {
  await migrate(sql);
  await resetAccounts();
  await migrate(sql);
  await account('admin', 'admin');
  await account('votante', 'votante');
  await account('analista', 'analista');
});
afterAll(async () => {
  globalThis.fetch = fetchReal;
  await sql.close();
});

test('solo quien puede editar el contenido ve los avisos', async () => {
  expect((await call('/api/admin/avisos')).status).toBe(401);
  expect((await call('/api/admin/avisos', 'GET', undefined, cookies.votante)).status).toBe(403);
  expect((await call('/api/admin/avisos', 'GET', undefined, cookies.analista)).status).toBe(403);
  expect(await avisos()).toEqual([]);
});

test('las alertas y sugerencias pendientes salen agrupadas por estado, con su cantidad', async () => {
  for (const [i, sector] of ['Barrio Central', 'La Ribera', 'El Progreso'].entries())
    await callPg(sql, 'alertCreate', [ids.votante, crypto.randomUUID(), 'agua', sector, null, 'Fuga de agua en la tubería principal.', null, VERSION_LEGAL]);
  await callPg(sql, 'suggestionCreate', [ids.votante, crypto.randomUUID(), 'agua-potable', 'Más puntos de agua en los barrios altos.', VERSION_LEGAL]);
  const [alerta] = await sql`SELECT id_alerta FROM tb_alertas ORDER BY id_alerta LIMIT 1`;
  expect((await call(`/api/admin/participacion/alertas/${alerta.id_alerta}/estado`, 'PATCH', { estado: 'en_revision', estadoAnterior: 'recibida' }, cookies.admin)).status).toBe(200);
  expect(await avisos()).toEqual([
    { clave: 'alertas:recibida', tipo: 'pendiente', icono: 'location', cantidad: 2, texto: '2 alertas ciudadanas nuevas', accion: 'Revisarlas', ruta: '/cuenta/panel/?aviso=alertas%3Arecibida#participacion' },
    { clave: 'alertas:en_revision', tipo: 'pendiente', icono: 'location', cantidad: 1, texto: '1 alerta ciudadana en revisión', accion: 'Revisarla', ruta: '/cuenta/panel/?aviso=alertas%3Aen_revision#participacion' },
    { clave: 'sugerencias:recibida', tipo: 'pendiente', icono: 'bulb', cantidad: 1, texto: '1 sugerencia nueva', accion: 'Verla', ruta: '/cuenta/panel/?aviso=sugerencias%3Arecibida#participacion' },
  ]);
  await sql`UPDATE tb_alertas SET estado = 'atendida'`;
  await sql`UPDATE tb_sugerencias SET estado = 'atendida'`;
  expect(await avisos()).toEqual([]);
});

test('un video publicado que su plataforma ya no deja mostrar es un aviso; se recuerda hasta que cambia el enlace', async () => {
  expect((await guardarVideo(REEL)).status).toBe(200);
  expect((await publicar()).status).toBe(200);
  bloqueado = true;
  const aviso = {
    clave: 'video:por-que-quiero-ser-alcalde', tipo: 'error', icono: 'alert', cantidad: 1, ruta: '/cuenta/panel/?aviso=video%3Apor-que-quiero-ser-alcalde#acerca-de-carlos',
    texto: 'El video de «Por qué quiero ser alcalde» ya no se puede ver en el sitio.', accion: 'Cambiar el video',
    detalle: avisoNoInsertable('facebook', 'bloqueado'), valor: REEL,
  };
  expect(await avisos()).toEqual([aviso]);
  consultas = 0;
  expect(await avisos()).toEqual([aviso]);
  expect(consultas).toBe(0);

  // Con el video bloqueado en el borrador no se publica ningún otro cambio, y repetir tampoco crea publicaciones.
  expect((await call('/api/admin/contenido/textos/pie.linea-1', 'PUT', { valor: 'Por ti, San Lorenzo.', version: null }, cookies.admin)).status).toBe(200);
  const antes = await publicaciones();
  const rechazos = await Promise.all([1, 2].map(() => call('/api/admin/publicaciones', 'POST', undefined, cookies.admin)));
  for (const r of rechazos) {
    expect(r.status).toBe(422);
    expect((await r.json()).error).toBe('No se publicó: el video de «Por qué quiero ser alcalde» no se puede ver en el sitio. Cámbialo y vuelve a publicar.');
  }
  expect(await publicaciones()).toBe(antes);

  bloqueado = false;
  expect((await guardarVideo(OTRO)).status).toBe(200);
  expect((await publicar()).status).toBe(200);
  expect(await avisos()).toEqual([]);
});

test('si la plataforma no responde, se publica: no se bloquea por lo que no se pudo comprobar', async () => {
  expect((await guardarVideo(REEL)).status).toBe(200);
  sinRed = true;
  try {
    expect((await publicar()).status).toBe(200);
    expect(await avisos()).toEqual([]);
  } finally {
    sinRed = false;
  }
});
