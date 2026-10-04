import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createApp } from '../src/app';
import { TEXTO_ACEPTACION, VERSION_LEGAL } from '../src/contracts/legal';
import { callPg } from '../src/db/call';
import { migrate } from '../src/db/migrate';
import { createSecurity } from '../src/security';
import { testApp, PASSWORD } from './helpers';

const { sql, config, call, account, ids, cookies, sent, resetAccounts } = testApp('medios-pruebas-consentimiento');
const aceptacion = { version: VERSION_LEGAL, aceptada: true };
const register = { nombresCompletos: 'María', correo: 'consentimiento@example.com', contrasenia: PASSWORD,
  confirmarContrasenia: PASSWORD };
const original = createSecurity(config);
const googleApp = createApp({ sql, config, mailer: { async send() {} }, security: {
  ...original,
  async verifyGoogle(credential: string) {
    return { sub: credential.startsWith('legado') ? 'google-legado' : 'google-consentimiento',
      email: credential.startsWith('legado') ? 'legado@gmail.com' : 'consentimiento@gmail.com',
      verified: true, hostedDomain: null, name: 'María Google' };
  },
} });
const google = (body: object) => googleApp.handle(new Request(`${config.origin}/api/auth/google`, {
  method: 'POST', headers: { origin: config.origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
}));
const proof = (user: number) => sql`SELECT version, texto, aceptado_en FROM tb_aceptaciones_legales WHERE id_usuario = ${user}`;

beforeAll(async () => {
  await migrate(sql);
  await resetAccounts();
  await account('legado', 'votante', false, false);
  await account('sin-aceptacion', 'votante', false, false);
});
afterAll(() => sql.close());

test('el registro exige una acción afirmativa y la versión vigente antes de guardar o enviar correo', async () => {
  for (const extra of [{}, { aceptacion: { ...aceptacion, aceptada: false } }, { aceptacion: { ...aceptacion, idUsuario: ids.legado } }]) {
    expect((await call('/api/auth/register', 'POST', { ...register, ...extra })).status).toBe(422);
  }
  expect((await call('/api/auth/register', 'POST', { ...register,
    correo: 'version-antigua@example.com', aceptacion: { ...aceptacion, version: 'anterior' } })).status).toBe(409);
  expect((await sql`SELECT count(*)::int AS n FROM tb_registros_pendientes`)[0].n).toBe(0);
  expect(sent).toHaveLength(0);
});

test('la confirmación por correo conserva el texto y la fecha originales sin duplicar la prueba', async () => {
  const body = { ...register, aceptacion };
  expect((await call('/api/auth/register', 'POST', body)).status).toBe(200);
  const [pending] = await sql`SELECT * FROM tb_registros_pendientes`;
  expect(pending.version_legal).toBe(VERSION_LEGAL);
  expect(pending.texto_aceptacion).toBe(TEXTO_ACEPTACION);
  const repeated = await Promise.all([1, 2].map(() => call('/api/auth/register', 'POST', body)));
  expect(repeated.map(r => r.status)).toEqual([200, 200]);
  expect(sent).toHaveLength(1);
  const token = new URL(sent[0].url).searchParams.get('token');
  const verified = await Promise.all([1, 2].map(() => call('/api/auth/verify-email', 'POST', { token })));
  expect(verified.map(r => r.status)).toEqual([200, 200]);
  const [user] = await sql`SELECT id_usuario FROM tb_usuarios WHERE correo = ${register.correo}`;
  expect(await proof(user.id_usuario)).toEqual([{ version: VERSION_LEGAL, texto: TEXTO_ACEPTACION, aceptado_en: pending.aceptado_en }]);
});

test('un registro anterior sin prueba no crea una cuenta y puede solicitar un enlace nuevo inmediatamente', async () => {
  const body = { ...register, correo: 'pendiente-anterior@example.com', aceptacion };
  const mails = sent.length;
  await call('/api/auth/register', 'POST', body);
  const oldToken = new URL(sent.at(-1)!.url).searchParams.get('token');
  await sql`UPDATE tb_registros_pendientes p SET version_legal = NULL, texto_aceptacion = NULL, aceptado_en = NULL
    FROM tb_token_autenticacion t WHERE p.id_token_autenticacion = t.id_token_autenticacion AND t.correo = ${body.correo}`;
  expect((await call('/api/auth/verify-email', 'POST', { token: oldToken })).status).toBe(400);
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios WHERE correo = ${body.correo}`)[0].n).toBe(0);
  expect((await call('/api/auth/register', 'POST', body)).status).toBe(200);
  expect(sent.length).toBe(mails + 2);
  const token = new URL(sent.at(-1)!.url).searchParams.get('token');
  expect(token).not.toBe(oldToken);
  expect((await call('/api/auth/verify-email', 'POST', { token })).status).toBe(200);
});

test('Google no crea cuenta ni sesión hasta aceptar; los reintentos conservan una sola cuenta y prueba', async () => {
  const credential = 'nueva'.repeat(24);
  const pending = await google({ credential });
  expect(pending.status).toBe(200);
  expect(await pending.json()).toMatchObject({ requiereAceptacion: true, correo: 'consentimiento@gmail.com' });
  expect(pending.headers.getSetCookie()).toHaveLength(0);
  expect((await sql`SELECT count(*)::int AS n FROM tb_usuarios WHERE correo = 'consentimiento@gmail.com'`)[0].n).toBe(0);
  expect((await google({ credential, aceptacion: { ...aceptacion, aceptada: false } })).status).toBe(422);
  expect((await google({ credential, aceptacion: { ...aceptacion, version: 'anterior' } })).status).toBe(409);
  const completed = await Promise.all([1, 2].map(() => google({ credential, aceptacion })));
  expect(completed.map(r => r.status)).toEqual([200, 200]);
  const users = await sql`SELECT id_usuario FROM tb_usuarios WHERE correo = 'consentimiento@gmail.com'`;
  expect(users).toHaveLength(1);
  const first = await proof(users[0].id_usuario);
  expect(first).toHaveLength(1);
  expect(first[0]).toMatchObject({ version: VERSION_LEGAL, texto: TEXTO_ACEPTACION });
  expect((await sql`SELECT count(*)::int AS n FROM tb_identidades_autenticacion WHERE sujeto_externo = 'google-consentimiento'`)[0].n).toBe(1);
  await google({ credential, aceptacion });
  expect(await proof(users[0].id_usuario)).toEqual(first);
});

test('una cuenta existente puede entrar con Google sin atribuirle una aceptación', async () => {
  await sql`UPDATE tb_usuarios SET correo = 'legado@gmail.com' WHERE id_usuario = ${ids.legado}`;
  const response = await google({ credential: 'legado'.repeat(20) });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ user: { id: ids.legado } });
  expect(response.headers.getSetCookie().some(v => v.startsWith('access='))).toBe(true);
  expect(await proof(ids.legado)).toHaveLength(0);
  expect(await (await call('/api/me', 'GET', undefined, cookies.legado)).json()).toMatchObject({ terminosAceptados: false });
});

test('sin aceptación se conservan el acceso y el historial, pero ningún envío llega a la base', async () => {
  const cookie = cookies['sin-aceptacion'];
  const alert = new FormData();
  for (const [key, value] of Object.entries({ idempotencia: crypto.randomUUID(), tipo: 'baches', sector: 'Centro', descripcion: 'Hay un bache frente al parque' })) alert.set(key, value);
  alert.set('foto', new File(['contenido sin imagen'], 'foto.jpg', { type: 'image/jpeg' }));
  const requests = await Promise.all([
    call('/api/participacion/alertas', 'POST', alert, cookie),
    call('/api/participacion/sugerencias', 'POST', { idempotencia: crypto.randomUUID(), tema: 'otro', mensaje: 'Más iluminación junto al parque' }, cookie),
    call('/api/participacion/chat', 'POST', { idempotencia: crypto.randomUUID(), mensaje: 'Mi consulta sobre el barrio' }, cookie),
  ]);
  for (const response of requests) {
    expect(response.status).toBe(428);
    expect(await response.json()).toMatchObject({ requiereAceptacion: true });
  }
  expect((await call('/api/participacion/alertas/mias', 'GET', undefined, cookie)).status).toBe(200);
  expect((await call('/api/participacion/sugerencias/mias', 'GET', undefined, cookie)).status).toBe(200);
  const id = ids['sin-aceptacion'];
  expect(await callPg(sql, 'alertCreate', [id, crypto.randomUUID(), 'baches', 'Centro', null, 'Un bache frente al parque', null, VERSION_LEGAL])).toEqual([]);
  expect(await callPg(sql, 'suggestionCreate', [id, crypto.randomUUID(), 'otro', 'Más iluminación junto al parque', VERSION_LEGAL])).toEqual([]);
  expect(await callPg(sql, 'chatSend', [id, crypto.randomUUID(), 'a'.repeat(64), { texto: 'Respuesta' }, null, 'Consulta', VERSION_LEGAL])).toEqual([]);
});

test('aceptar requiere sesión, cuerpo estricto y versión vigente; simultáneos no cambian fecha ni perfil', async () => {
  const cookie = cookies['sin-aceptacion'];
  expect((await call('/api/auth/accept-terms', 'POST', { aceptacion })).status).toBe(401);
  expect((await call('/api/auth/accept-terms', 'POST', { aceptacion: { ...aceptacion, aceptada: false } }, cookie)).status).toBe(422);
  expect((await call('/api/auth/accept-terms', 'POST', { aceptacion, idUsuario: ids.legado }, cookie)).status).toBe(422);
  expect((await call('/api/auth/accept-terms', 'POST', { aceptacion: { ...aceptacion, version: 'anterior' } }, cookie)).status).toBe(409);
  const [profile] = await sql`SELECT version_perfil, actualizado_en FROM tb_usuarios WHERE id_usuario = ${ids['sin-aceptacion']}`;
  const responses = await Promise.all([1, 2, 3].map(() => call('/api/auth/accept-terms', 'POST', { aceptacion }, cookie)));
  expect(responses.map(r => r.status)).toEqual([200, 200, 200]);
  const first = await proof(ids['sin-aceptacion']);
  expect(first).toHaveLength(1);
  expect(await (await call('/api/me', 'GET', undefined, cookie)).json()).toMatchObject({ terminosAceptados: true });
  await call('/api/auth/accept-terms', 'POST', { aceptacion }, cookie);
  expect(await proof(ids['sin-aceptacion'])).toEqual(first);
  expect((await sql`SELECT version_perfil, actualizado_en FROM tb_usuarios WHERE id_usuario = ${ids['sin-aceptacion']}`)[0]).toEqual(profile);
  expect(await callPg(sql, 'legalAccept', [ids['sin-aceptacion'], VERSION_LEGAL, 'Otro texto'])).toEqual([{ resultado: 'conflicto', aceptado_en: null }]);
  expect(await proof(ids['sin-aceptacion'])).toEqual(first);
  const request = { idempotencia: crypto.randomUUID(), tema: 'otro', mensaje: 'Más iluminación alrededor del parque' };
  const repeated = await Promise.all([1, 2].map(() => call('/api/participacion/sugerencias', 'POST', request, cookie)));
  expect(repeated.map(r => r.status)).toEqual([200, 200]);
  expect(await repeated[0].json()).toEqual(await repeated[1].json());
});

test('la función de aceptación vuelve a comprobar el permiso sin sobrescribir las pruebas', async () => {
  await sql.begin(async tx => {
    await tx`DELETE FROM tb_rol_permisos rp USING tb_roles r, tb_permisos p
      WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso AND r.rol = 'votante' AND p.codigo = 'perfil.ver'`;
    expect(await callPg(tx, 'legalAccept', [ids.legado, VERSION_LEGAL, TEXTO_ACEPTACION])).toEqual([]);
    await tx`INSERT INTO tb_rol_permisos (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permiso FROM tb_roles r CROSS JOIN tb_permisos p WHERE r.rol = 'votante' AND p.codigo = 'perfil.ver'`;
  });
  expect(await proof(ids.legado)).toHaveLength(0);
});

test('si desaparece la prueba se vuelve a pedir, incluso con la misma sesión', async () => {
  const id = ids['sin-aceptacion'];
  await sql`DELETE FROM tb_aceptaciones_legales WHERE id_usuario = ${id}`;
  const cookie = cookies['sin-aceptacion'];
  expect(await (await call('/api/me', 'GET', undefined, cookie)).json()).toMatchObject({ terminosAceptados: false });
  expect((await call('/api/participacion/chat', 'POST', { idempotencia: crypto.randomUUID(), mensaje: 'Otra consulta' }, cookie)).status).toBe(428);
});
