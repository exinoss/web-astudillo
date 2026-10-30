import { afterAll, beforeAll, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import { PARROQUIAS } from '../src/contracts/parroquias';
import { diff } from '../src/content/services/content';
import { migrate } from '../src/db/migrate';
import { testApp } from './helpers';

const MEDIA = 'medios-pruebas-mi-equipo';
const { sql, cookies, call, account, resetAccounts } = testApp(MEDIA);
const EQUIPO = '/api/admin/contenido/mi-equipo/equipo';
const parroquia = (slug: string) => `/api/admin/contenido/mi-equipo/parroquias/${slug}`;

const draft = async () => (await call('/api/admin/contenido', 'GET', undefined, cookies.coadmin)).json();
const version = async (clave: string) => ((await draft()).versiones.miEquipo[clave] ?? null) as string | null;

async function photo(color: string) {
  const form = new FormData();
  const buffer = await sharp({ create: { width: 900, height: 1200, channels: 3, background: color } }).png().toBuffer();
  form.append('foto', new File([new Uint8Array(buffer)], 'foto.png'));
  return (await call('/api/admin/medios', 'POST', form, cookies.coadmin)).json() as Promise<{ idMedio: number }>;
}

const persona = (nombre: string, idMedio: number | null = null, quien = 'Concejala rural') => ({ idMedio, nombre, quien });

beforeAll(async () => {
  await migrate(sql);
  // Vaciar las cuentas arrastra en cascada las publicaciones; migrar de nuevo vuelve a sembrar la inicial.
  await resetAccounts();
  await sql`TRUNCATE tb_mi_equipo`;
  await migrate(sql);
  await account('admin', 'admin');
  await account('coadmin', 'coadmin');
  await account('votante', 'votante');
});
afterAll(async () => {
  await rm(MEDIA, { recursive: true, force: true }).catch(() => {});
  await sql.close();
});

test('sin contenido, el equipo está vacío, salen las doce parroquias y ninguna parte tiene versión', async () => {
  const c = await draft();
  expect(c.miEquipo.equipo).toEqual([]);
  expect(c.miEquipo.parroquias).toEqual(PARROQUIAS.map(p => ({ slug: p.slug, texto: '', fotos: [] })));
  expect(c.versiones.miEquipo).toEqual({});
});

test('guardar el equipo resuelve las fotos, admite personas sin foto y repetirlo no duplica nada', async () => {
  const foto = await photo('#c0392b');
  const body = { personas: [persona('Ana Quiñónez', foto.idMedio), persona('Luis Cortez', null, '   ')], version: await version('equipo') };
  const first = await call(EQUIPO, 'PUT', body, cookies.coadmin);
  expect(first.status).toBe(200);
  const again = await call(EQUIPO, 'PUT', body, cookies.coadmin);
  expect(again.status).toBe(200);
  expect((await again.json()).version).toBe((await first.json()).version);
  const { equipo } = (await draft()).miEquipo;
  expect(equipo[0]).toMatchObject({ nombre: 'Ana Quiñónez', quien: 'Concejala rural', foto: { idMedio: foto.idMedio } });
  expect(equipo[1]).toEqual({ nombre: 'Luis Cortez', quien: null, foto: null });
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM tb_auditoria WHERE accion = 'mi_equipo_guardado'`;
  expect(n).toBe(1);
});

test('dos personas guardando a la vez la misma parroquia: una gana y la otra recibe 409 sin pisarla', async () => {
  const loaded = await version('calderon');
  expect(loaded).toBeNull();
  const save = (texto: string) => call(parroquia('calderon'), 'PUT', { texto, fotos: [], version: loaded }, cookies.coadmin);
  const replies = await Promise.all([save('Agua para todos los recintos.'), save('Caminos lastrados.')]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await replies.find(r => r.status === 409)!.json()).error).toContain('Otra persona');
  const winner = replies[0].status === 200 ? 'Agua para todos los recintos.' : 'Caminos lastrados.';
  expect((await draft()).miEquipo.parroquias.find((p: { slug: string }) => p.slug === 'calderon').texto).toBe(winner);
});

test('dos personas guardando el equipo a la vez: una gana y la otra recibe 409 sin pisarla', async () => {
  const loaded = await version('equipo');
  const save = (nombre: string) => call(EQUIPO, 'PUT', { personas: [persona(nombre)], version: loaded }, cookies.coadmin);
  const replies = await Promise.all([save('Marta Angulo'), save('Pedro Bone')]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 409]);
  const winner = replies[0].status === 200 ? 'Marta Angulo' : 'Pedro Bone';
  expect((await draft()).miEquipo.equipo.map((p: { nombre: string }) => p.nombre)).toEqual([winner]);
});

test('cada parroquia guarda su texto con párrafos y sus fotos; repetirla no duplica y el texto puede quedar vacío', async () => {
  const [a, b] = await Promise.all([photo('#16a085'), photo('#2c3e50')]);
  const body = { texto: 'Primer párrafo.\n\nSegundo párrafo.', fotos: [{ idMedio: a.idMedio, alt: 'Reunión en la casa comunal' }, { idMedio: b.idMedio, alt: 'Recorrido por el río' }] };
  const loaded = await version('alto-tambo');
  const first = await call(parroquia('alto-tambo'), 'PUT', { ...body, version: loaded }, cookies.coadmin);
  const again = await call(parroquia('alto-tambo'), 'PUT', { ...body, version: loaded }, cookies.coadmin);
  expect([first.status, again.status]).toEqual([200, 200]);
  expect((await again.json()).version).toBe((await first.json()).version);
  expect((await call(parroquia('urbina'), 'PUT', { texto: '  ', fotos: [body.fotos[0]], version: await version('urbina') }, cookies.coadmin)).status).toBe(200);
  const parishes = (await draft()).miEquipo.parroquias;
  const altoTambo = parishes.find((p: { slug: string }) => p.slug === 'alto-tambo');
  expect(altoTambo.texto).toBe('Primer párrafo.\n\nSegundo párrafo.');
  expect(altoTambo.fotos.map((f: { alt: string; foto: { idMedio: number } }) => [f.alt, f.foto.idMedio])).toEqual([['Reunión en la casa comunal', a.idMedio], ['Recorrido por el río', b.idMedio]]);
  expect(parishes.find((p: { slug: string }) => p.slug === 'urbina')).toMatchObject({ texto: '', fotos: [{ alt: 'Reunión en la casa comunal' }] });
});

test('una foto borrada deja a la persona sin foto y desaparece de la parroquia', async () => {
  const foto = await photo('#8e44ad');
  expect((await call(EQUIPO, 'PUT', { personas: [persona('Rosa Valencia', foto.idMedio)], version: await version('equipo') }, cookies.coadmin)).status).toBe(200);
  expect((await call(parroquia('tambillo'), 'PUT', { texto: 'Texto.', fotos: [{ idMedio: foto.idMedio, alt: 'Foto' }], version: await version('tambillo') }, cookies.coadmin)).status).toBe(200);
  await sql`DELETE FROM tb_medios WHERE id_medio = ${foto.idMedio}`;
  const { equipo, parroquias } = (await draft()).miEquipo;
  expect(equipo).toEqual([{ nombre: 'Rosa Valencia', quien: 'Concejala rural', foto: null }]);
  expect(parroquias.find((p: { slug: string }) => p.slug === 'tambillo').fotos).toEqual([]);
});

test('valida textos, fotos, cantidades, permisos y parroquias', async () => {
  const foto = await photo('#f39c12');
  const team = async (personas: object[], who = 'coadmin') => (await call(EQUIPO, 'PUT', { personas, version: await version('equipo') }, cookies[who])).status;
  const parish = async (body: object, slug = 'santa-rita') => (await call(parroquia(slug), 'PUT', { texto: '', fotos: [], version: await version(slug), ...body }, cookies.coadmin)).status;
  expect(await team([persona('  ')])).toBe(422);
  expect(await team([persona('<b>Ana</b>')])).toBe(422);
  expect(await team([persona('Ana\nQuiñónez')])).toBe(422);
  expect(await team([persona('Ana', 999999)])).toBe(422);
  expect(await team(Array.from({ length: 10 }, (_, i) => persona(`Persona ${i}`)))).toBe(422);
  expect(await team([{ ...persona('Ana'), extra: true }])).toBe(422);
  expect(await team([persona('Ana')], 'votante')).toBe(403);
  expect(await parish({ texto: '<script>alert(1)</script>' })).toBe(422);
  expect(await parish({ fotos: [{ idMedio: foto.idMedio, alt: '' }] })).toBe(422);
  expect(await parish({ fotos: Array.from({ length: 7 }, () => ({ idMedio: foto.idMedio, alt: 'Foto' })) })).toBe(422);
  expect(await parish({}, 'equipo')).toBe(404);
  expect(await parish({}, 'quito')).toBe(404);
  expect((await call(EQUIPO, 'PUT', { personas: [], version: null })).status).toBe(401);
});

test('publicar congela «Mi equipo», los pendientes lo nombran y un snapshot anterior sin él no cuenta como cambio', async () => {
  const pending = await (await call('/api/admin/publicaciones/pendientes', 'GET', undefined, cookies.admin)).json();
  expect(pending.cambios).toContainEqual({ tipo: 'Mi equipo', descripcion: 'Equipo' });
  expect(pending.cambios).toContainEqual({ tipo: 'Mi equipo', descripcion: 'Alto Tambo' });
  expect(pending.cambios).not.toContainEqual({ tipo: 'Mi equipo', descripcion: 'Carondelet' });
  expect((await call('/api/admin/publicaciones', 'POST', undefined, cookies.admin)).status).toBe(200);
  const [{ contenido }] = await sql`SELECT contenido FROM tb_publicaciones ORDER BY id_publicacion DESC LIMIT 1`;
  expect(contenido.miEquipo.equipo[0].nombre).toBe('Rosa Valencia');
  const current = await draft();
  const emptyTeam = { ...current, miEquipo: { equipo: [], parroquias: PARROQUIAS.map(p => ({ slug: p.slug, texto: '', fotos: [] })) } };
  const { miEquipo: _, ...older } = emptyTeam;
  expect(diff(older, emptyTeam).filter(c => c.tipo === 'Mi equipo')).toEqual([]);
});
