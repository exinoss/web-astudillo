import { afterAll, beforeAll, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import { diff } from '../src/content/services/content';
import { HOME_CAROUSELS_SEED } from '../src/content/services/home-carousels';
import { AVISO_HORIZONTAL } from '../src/contracts/inicio';
import { migrate } from '../src/db/migrate';
import { testApp } from './helpers';

const MEDIA = 'medios-pruebas-inicio';
const { sql, cookies, call, account, resetAccounts } = testApp(MEDIA);
const PRINCIPAL = '/api/admin/contenido/inicio/principal';
const PIEZAS = '/api/admin/contenido/inicio/piezas';
const EQUIPO = '/api/admin/contenido/inicio/equipo';
const SIN_EQUIPO = { fotos: [] };

const draft = async () => (await call('/api/admin/contenido', 'GET', undefined, cookies.coadmin)).json();
const version = async (clave: 'principal' | 'piezas' | 'equipo') => ((await draft()).versiones.inicio[clave] ?? null) as string | null;

async function photo(color: string, width = 2400, height = 914) {
  const form = new FormData();
  const buffer = await sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
  form.append('foto', new File([new Uint8Array(buffer)], 'foto.png'));
  return (await call('/api/admin/medios', 'POST', form, cookies.coadmin)).json() as Promise<{ idMedio: number; anchos: number[] }>;
}

const retrato = { imagen: { original: 'pieza-respeto' }, alt: 'Retrato de Carlos Astudillo' };

beforeAll(async () => {
  await migrate(sql);
  await resetAccounts();
  await sql`TRUNCATE tb_inicio_carruseles`;
  await migrate(sql);
  await account('admin', 'admin');
  await account('coadmin', 'coadmin');
  await account('votante', 'votante');
});
afterAll(async () => {
  await rm(MEDIA, { recursive: true, force: true }).catch(() => {});
  await sql.close();
});

test('la semilla crea los dos carruseles con las imágenes del sitio, con versión y sin cambios pendientes', async () => {
  const c = await draft();
  expect(c.inicio).toEqual({ ...HOME_CAROUSELS_SEED, equipo: SIN_EQUIPO });
  expect(c.inicio.principal.banners[0].imagen).toEqual({ original: 'portada' });
  expect(c.inicio.piezas.piezas).toHaveLength(3);
  expect(Object.keys(c.versiones.inicio).sort()).toEqual(['piezas', 'principal']);
  const pending = await (await call('/api/admin/publicaciones/pendientes', 'GET', undefined, cookies.admin)).json();
  expect(pending.cambios.filter((x: { tipo: string }) => x.tipo === 'Portada')).toEqual([]);
});

test('un banner subido convive con el original, lleva su foto para celular y repetirlo no duplica nada', async () => {
  const [banner, celular] = await Promise.all([photo('#c0392b'), photo('#2980b9', 1520, 1140)]);
  expect(banner.anchos).toEqual([480, 960, 1600, 2000]);
  const body = {
    banners: [
      { imagen: { original: 'portada' }, celular: null, alt: 'Banner original' },
      { imagen: { idMedio: banner.idMedio }, celular: celular.idMedio, alt: '  Carlos con vecinos  ' },
    ],
    retrato, version: await version('principal'),
  };
  const first = await call(PRINCIPAL, 'PUT', body, cookies.coadmin);
  expect(first.status).toBe(200);
  const again = await call(PRINCIPAL, 'PUT', body, cookies.coadmin);
  expect(again.status).toBe(200);
  expect((await again.json()).version).toBe((await first.json()).version);
  const { banners } = (await draft()).inicio.principal;
  expect(banners[0]).toEqual({ imagen: { original: 'portada' }, celular: null, alt: 'Banner original' });
  expect(banners[1]).toMatchObject({ imagen: { foto: { idMedio: banner.idMedio } }, celular: { idMedio: celular.idMedio }, alt: 'Carlos con vecinos' });
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM tb_auditoria WHERE accion = 'carrusel_inicio_guardado'`;
  expect(n).toBe(1);
});

test('dos personas guardando a la vez el mismo carrusel: una gana y la otra recibe 409 sin pisarla', async () => {
  const loaded = await version('piezas');
  const save = (alt: string) => call(PIEZAS, 'PUT', { piezas: [{ imagen: { original: 'pieza-ferrocarril' }, alt }], version: loaded }, cookies.coadmin);
  const replies = await Promise.all([save('Pieza de Ana'), save('Pieza de Luis')]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await replies.find(r => r.status === 409)!.json()).error).toContain('Otra persona');
  const winner = replies[0].status === 200 ? 'Pieza de Ana' : 'Pieza de Luis';
  expect((await draft()).inicio.piezas.piezas.map((p: { alt: string }) => p.alt)).toEqual([winner]);
});

test('una foto borrada desaparece de su carrusel; sin imágenes, vuelven las de la semilla', async () => {
  const foto = await photo('#8e44ad', 1080, 1350);
  expect((await call(PIEZAS, 'PUT', { piezas: [{ imagen: { idMedio: foto.idMedio }, alt: 'Pieza' }], version: await version('piezas') }, cookies.coadmin)).status).toBe(200);
  const nuevoRetrato = { imagen: { idMedio: foto.idMedio }, alt: 'Otro retrato' };
  const { banners } = (await draft()).inicio.principal;
  const body = banners.map((b: { imagen: { original?: string; foto?: { idMedio: number } }; celular: { idMedio: number } | null; alt: string }) => ({
    imagen: b.imagen.foto ? { idMedio: b.imagen.foto.idMedio } : b.imagen, celular: b.celular?.idMedio ?? null, alt: b.alt,
  }));
  expect((await call(PRINCIPAL, 'PUT', { banners: body, retrato: nuevoRetrato, version: await version('principal') }, cookies.coadmin)).status).toBe(200);
  await sql`DELETE FROM tb_medios WHERE id_medio = ${foto.idMedio}`;
  const { inicio } = await draft();
  expect(inicio.piezas).toEqual(HOME_CAROUSELS_SEED.piezas);
  expect(inicio.principal.retrato).toEqual(HOME_CAROUSELS_SEED.principal.retrato);
  expect(inicio.principal.banners).toHaveLength(2);
});

test('el carrusel del equipo empieza vacío, sin semilla; guarda imágenes horizontales y repetirlo no duplica nada', async () => {
  expect((await draft()).inicio.equipo).toEqual(SIN_EQUIPO);
  expect(await version('equipo')).toBeNull();
  const [a, b] = await Promise.all([photo('#16a085', 2000, 1167), photo('#2c3e50')]);
  const body = { fotos: [{ idMedio: a.idMedio, alt: '  Carlos con su equipo  ' }, { idMedio: b.idMedio, alt: 'Pancarta' }], version: null };
  const first = await call(EQUIPO, 'PUT', body, cookies.coadmin);
  const again = await call(EQUIPO, 'PUT', body, cookies.coadmin);
  expect([first.status, again.status]).toEqual([200, 200]);
  expect((await again.json()).version).toBe((await first.json()).version);
  const { fotos } = (await draft()).inicio.equipo;
  expect(fotos.map((f: { alt: string; foto: { idMedio: number } }) => [f.alt, f.foto.idMedio])).toEqual([['Carlos con su equipo', a.idMedio], ['Pancarta', b.idMedio]]);
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM tb_auditoria WHERE accion = 'carrusel_inicio_guardado' AND cambios->>'clave' = 'equipo'`;
  expect(n).toBe(1);
});

test('el carrusel del equipo rechaza imágenes verticales o cuadradas, puede quedar vacío y no vuelve a ninguna semilla', async () => {
  const [vertical, cuadrada, ancha] = await Promise.all([photo('#c0392b', 900, 1200), photo('#2980b9', 1000, 1000), photo('#27ae60')]);
  const save = async (ids: number[]) => call(EQUIPO, 'PUT', { fotos: ids.map(idMedio => ({ idMedio, alt: 'Foto' })), version: await version('equipo') }, cookies.coadmin);
  for (const id of [vertical.idMedio, cuadrada.idMedio]) {
    const reply = await save([ancha.idMedio, id]);
    expect(reply.status).toBe(422);
    expect((await reply.json()).error).toBe(AVISO_HORIZONTAL);
  }
  expect((await save([ancha.idMedio])).status).toBe(200);
  await sql`DELETE FROM tb_medios WHERE id_medio = ${ancha.idMedio}`;
  expect((await draft()).inicio.equipo).toEqual(SIN_EQUIPO);
  expect((await save([])).status).toBe(200);
  expect((await save(Array.from({ length: 9 }, () => ancha.idMedio))).status).toBe(422);
});

test('dos personas guardando a la vez el carrusel del equipo: una gana y la otra recibe 409 sin pisarla', async () => {
  const foto = await photo('#8e44ad');
  const loaded = await version('equipo');
  const save = (alt: string) => call(EQUIPO, 'PUT', { fotos: [{ idMedio: foto.idMedio, alt }], version: loaded }, cookies.coadmin);
  const replies = await Promise.all([save('Foto de Ana'), save('Foto de Luis')]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 409]);
  const winner = replies[0].status === 200 ? 'Foto de Ana' : 'Foto de Luis';
  expect((await draft()).inicio.equipo.fotos.map((f: { alt: string }) => f.alt)).toEqual([winner]);
});

test('valida descripciones, fotos, cantidades, imágenes del sitio y permisos', async () => {
  const foto = await photo('#f39c12');
  const main = async (body: object, who = 'coadmin') =>
    (await call(PRINCIPAL, 'PUT', { banners: [{ imagen: { original: 'portada' }, celular: null, alt: 'Banner' }], retrato, version: await version('principal'), ...body }, cookies[who])).status;
  const pieces = async (piezas: object[]) => (await call(PIEZAS, 'PUT', { piezas, version: await version('piezas') }, cookies.coadmin)).status;
  const banner = (extra: object = {}) => ({ imagen: { idMedio: foto.idMedio }, celular: null, alt: 'Banner', ...extra });
  expect(await main({ banners: [] })).toBe(422);
  expect(await main({ banners: Array.from({ length: 6 }, () => banner()) })).toBe(422);
  expect(await main({ banners: [banner({ alt: '   ' })] })).toBe(422);
  expect(await main({ banners: [banner({ alt: '<b>Banner</b>' })] })).toBe(422);
  expect(await main({ banners: [banner({ imagen: { idMedio: 999999 } })] })).toBe(422);
  expect(await main({ banners: [banner({ celular: 999999 })] })).toBe(422);
  expect(await main({ banners: [banner({ imagen: { original: 'otra' } })] })).toBe(422);
  expect(await main({ banners: [banner({ imagen: { original: 'portada', idMedio: foto.idMedio } })] })).toBe(422);
  expect(await main({ retrato: { imagen: { original: 'portada' }, alt: '' } })).toBe(422);
  expect(await main({}, 'votante')).toBe(403);
  expect(await pieces([])).toBe(422);
  expect(await pieces(Array.from({ length: 9 }, () => ({ imagen: { original: 'pieza-ferrocarril' }, alt: 'Pieza' })))).toBe(422);
  expect(await pieces([{ imagen: { original: 'pieza-ferrocarril' }, alt: 'Pieza', extra: 1 }])).toBe(422);
  expect((await call(PIEZAS, 'PUT', { piezas: [{ imagen: { original: 'pieza-ferrocarril' }, alt: 'Pieza' }], version: null })).status).toBe(401);
});

test('publicar congela los carruseles, los pendientes los nombran y un snapshot anterior sin ellos no cuenta como cambio', async () => {
  const pending = await (await call('/api/admin/publicaciones/pendientes', 'GET', undefined, cookies.admin)).json();
  expect(pending.cambios).toContainEqual({ tipo: 'Portada', descripcion: 'Carrusel principal' });
  expect(pending.cambios).toContainEqual({ tipo: 'Portada', descripcion: 'Carrusel del equipo' });
  expect((await call('/api/admin/publicaciones', 'POST', undefined, cookies.admin)).status).toBe(200);
  const [{ contenido }] = await sql`SELECT contenido FROM tb_publicaciones ORDER BY id_publicacion DESC LIMIT 1`;
  expect(contenido.inicio.principal.banners).toHaveLength(2);
  const current = await draft();
  const seeded = { ...current, inicio: { ...HOME_CAROUSELS_SEED, equipo: SIN_EQUIPO } };
  const { inicio: _, ...older } = seeded;
  expect(diff(older, seeded).filter(c => c.tipo === 'Portada')).toEqual([]);
});
