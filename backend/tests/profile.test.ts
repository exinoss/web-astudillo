import { afterAll, beforeAll, expect, test } from 'bun:test';
import { migrate } from '../src/db/migrate';
import { callPg } from '../src/db/call';
import { testApp } from './helpers';

const { sql, call, ids, cookies, account, resetAccounts } = testApp();
beforeAll(async () => {
  await migrate(sql);
  await resetAccounts();
  await account('perfil', 'votante');
});
afterAll(() => sql.close());
const read = async () => (await call('/api/me', 'GET', undefined, cookies.perfil)).json();
const save = (nombresCompletos: string, versionPerfil?: number) =>
  call('/api/me', 'PATCH', { nombresCompletos, direccion: 'Centro', versionPerfil }, cookies.perfil);
const state = async () => (await sql`SELECT version_perfil, actualizado_en,
  (SELECT count(*)::int FROM tb_auditoria WHERE id_actor = ${ids.perfil} AND accion = 'perfil_actualizado') AS auditorias
  FROM tb_usuarios WHERE id_usuario = ${ids.perfil}`)[0];

test('el perfil exige versión válida y mantiene las cuentas anteriores', async () => {
  expect((await read()).versionPerfil).toBe(1);
  expect((await save('Otro')).status).toBe(409);
  expect((await save('Otro', 0)).status).toBe(422);
  expect((await save('Otro', 1.5)).status).toBe(422);
  expect((await read()).nombresCompletos).toBe('perfil');
  expect((await state()).auditorias).toBe(0);
});

test('guardar sin cambios y repetir un guardado conservan versión, fecha y auditoría', async () => {
  const loaded = await read();
  const before = await state();
  expect((await call('/api/me', 'PATCH', { nombresCompletos: loaded.nombresCompletos,
    direccion: loaded.direccion ?? '', versionPerfil: loaded.versionPerfil }, cookies.perfil)).status).toBe(200);
  expect(await state()).toEqual(before);
  const first = await save('Nuevo', loaded.versionPerfil);
  expect(first.status).toBe(200);
  expect((await first.json()).versionPerfil).toBe(loaded.versionPerfil + 1);
  const applied = await state();
  expect(applied.auditorias).toBe(before.auditorias + 1);
  expect((await save('Nuevo', loaded.versionPerfil)).status).toBe(200);
  expect(await state()).toEqual(applied);
  expect((await save('Distinto', loaded.versionPerfil)).status).toBe(409);
  expect(await state()).toEqual(applied);
});

test('ediciones simultáneas con datos distintos producen un éxito y un conflicto', async () => {
  const loaded = await read();
  const before = await state();
  const results = await Promise.all([save('Primero', loaded.versionPerfil), save('Segundo', loaded.versionPerfil)]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  const current = await read();
  expect(['Primero', 'Segundo']).toContain(current.nombresCompletos);
  expect(current.versionPerfil).toBe(loaded.versionPerfil + 1);
  expect((await state()).auditorias).toBe(before.auditorias + 1);
});

test('repeticiones simultáneas del mismo guardado cambian una sola vez', async () => {
  const loaded = await read();
  const before = await state();
  const results = await Promise.all([save('Repetido', loaded.versionPerfil), save('Repetido', loaded.versionPerfil)]);
  expect(results.map(result => result.status)).toEqual([200, 200]);
  const applied = await state();
  expect(applied.version_perfil).toBe(loaded.versionPerfil + 1);
  expect(applied.auditorias).toBe(before.auditorias + 1);
  expect((await save('Repetido', loaded.versionPerfil)).status).toBe(200);
  expect(await state()).toEqual(applied);
});

test('la función SQL comprueba los permisos y no admite el contrato antiguo', async () => {
  expect((await sql`SELECT to_regprocedure('fn_profile_update(integer,text,text)') AS antigua`)[0].antigua).toBeNull();
  await sql`UPDATE tb_usuarios SET estado = 'bloqueado' WHERE id_usuario = ${ids.perfil}`;
  const before = await state();
  expect(await callPg(sql, 'profileUpdate', [ids.perfil, 'Sin permiso', null, before.version_perfil])).toEqual([]);
  expect(await state()).toEqual(before);
});

test('nombre y dirección del perfil solo admiten texto plano', async () => {
  // La prueba anterior deja la cuenta bloqueada a propósito.
  await sql`UPDATE tb_usuarios SET estado = 'activo' WHERE id_usuario = ${ids.perfil}`;
  const { versionPerfil } = await read();
  const patch = (nombresCompletos: string, direccion: string) =>
    call('/api/me', 'PATCH', { nombresCompletos, direccion, versionPerfil }, cookies.perfil);
  for (const [nombre, direccion] of [
    ['<img src=x onerror=alert(1)>', 'Centro'], ['Ana\u202eadmin', 'Centro'], ['Ana\nOtra', 'Centro'], ['Ana', 'Calle <b>5</b>'],
  ]) expect((await patch(nombre, direccion)).status).toBe(422);
  expect((await read()).versionPerfil).toBe(versionPerfil);
  const ok = await patch("José Ñúñez O'Brien", 'Barrio La Merced, calles 5 & 6');
  expect(ok.status).toBe(200);
  expect((await ok.json()).nombresCompletos).toBe("José Ñúñez O'Brien");
});
