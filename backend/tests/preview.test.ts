import { afterAll, beforeAll, expect, test } from 'bun:test';
import { callPg } from '../src/db/call';
import { migrate } from '../src/db/migrate';
import { testApp } from './helpers';

const { sql, cookies, ids, call, account, resetAccounts } = testApp('medios-pruebas-vista-previa');
const PREVIEW = '/api/admin/vista-previa';

const request = async (who = 'coadmin') => {
  const res = await call(PREVIEW, 'POST', undefined, cookies[who]);
  return { status: res.status, estado: res.ok ? (await res.json()).estado : null };
};
const row = async () => (await sql`SELECT estado, contenido FROM tb_vista_previa WHERE id = 1`)[0];
const claim = () => callPg<{ contenido: Record<string, unknown> }>(sql, 'previewClaim');
const finish = (ok: boolean) => callPg(sql, 'previewFinish', [ok, ok ? null : 'registro']);
const editText = async (valor: string) => {
  const draft = await (await call('/api/admin/contenido', 'GET', undefined, cookies.coadmin)).json();
  const key = Object.keys(draft.originales)[0];
  const res = await call(`/api/admin/contenido/textos/${key}`, 'PUT', { valor, version: draft.versiones.textos[key] ?? null }, cookies.coadmin);
  expect(res.status).toBe(200);
  return key;
};
async function enter(who = 'coadmin') {
  const res = await call(`${PREVIEW}/entrar`, 'POST', undefined, cookies[who]);
  return { status: res.status, cookie: res.headers.getSetCookie().find(v => v.startsWith('vista_previa=')) };
}
const allowed = async (cookie?: string) => (await call('/api/vista-previa/acceso', 'GET', undefined, cookie)).status;

beforeAll(async () => {
  await migrate(sql);
  await resetAccounts();
  await sql`TRUNCATE tb_vista_previa`;
  await migrate(sql);
  await account('coadmin', 'coadmin');
  await account('votante', 'votante');
});
afterAll(() => sql.close());

test('pedir la vista previa congela el borrador con los textos completos; repetirla no compila otra vez', async () => {
  expect(await request()).toEqual({ status: 200, estado: 'en_cola' });
  const { contenido } = await row();
  expect(Object.keys(contenido.originales).length).toBeGreaterThan(0);
  expect(Object.keys(contenido.textos)).toEqual(expect.arrayContaining(Object.keys(contenido.originales)));
  expect(await request()).toEqual({ status: 200, estado: 'en_cola' });
  expect((await (await call(PREVIEW, 'GET', undefined, cookies.coadmin)).json()).estado).toBe('en_cola');

  expect(await claim()).toHaveLength(1);
  expect(await claim()).toHaveLength(0);
  expect(await request()).toEqual({ status: 200, estado: 'compilando' });
  await finish(true);
  expect(await request()).toEqual({ status: 200, estado: 'lista' });
});

test('si el borrador cambia mientras compila, esa compilación no se da por lista', async () => {
  await editText('Un lema para la vista previa.');
  expect(await request()).toEqual({ status: 200, estado: 'en_cola' });
  await claim();
  const key = await editText('Otro lema mientras compilaba.');
  expect(await request()).toEqual({ status: 200, estado: 'en_cola' });
  await finish(true);
  expect((await row()).estado).toBe('en_cola');
  expect((await row()).contenido.textos[key]).toBe('Otro lema mientras compilaba.');

  await claim();
  await finish(false);
  expect((await row()).estado).toBe('fallida');
  expect(await request()).toEqual({ status: 200, estado: 'en_cola' });
});

test('al arrancar el publicador, una vista previa a medias o lista se vuelve a compilar', async () => {
  await claim();
  await callPg(sql, 'previewRecover');
  expect((await row()).estado).toBe('en_cola');
});

test('sin permiso para editar no se pide ni se consulta la vista previa', async () => {
  expect((await request('votante')).status).toBe(403);
  expect((await call(PREVIEW, 'POST')).status).toBe(401);
  expect((await call(PREVIEW, 'GET', undefined, cookies.votante)).status).toBe(403);
  expect((await enter('votante')).status).toBe(403);
});

test('el pase de la vista previa vale para todo el sitio y deja de valer si la cuenta pierde el permiso', async () => {
  const { status, cookie } = await enter();
  expect(status).toBe(200);
  expect(cookie).toContain('Path=/;');
  expect(cookie).toContain('HttpOnly');
  const pass = cookie!.split(';')[0];
  expect(await allowed(pass)).toBe(204);
  expect(await allowed()).toBe(401);
  expect(await allowed(`${pass.slice(0, -2)}xx`)).toBe(401);
  expect(await allowed(cookies.coadmin.replace('access=', 'vista_previa='))).toBe(401);

  await sql`UPDATE tb_usuarios SET rol = 'votante' WHERE id_usuario = ${ids.coadmin}`;
  expect(await allowed(pass)).toBe(401);
  await sql`UPDATE tb_usuarios SET rol = 'coadmin' WHERE id_usuario = ${ids.coadmin}`;
});

test('salir borra el pase y solo vuelve a rutas del propio sitio', async () => {
  const exit = async (query: string) => {
    const res = await call(`/api/vista-previa/salir${query}`);
    expect(res.status).toBe(303);
    expect(res.headers.getSetCookie().find(v => v.startsWith('vista_previa='))).toMatch(/^vista_previa=;.*Max-Age=0/);
    return res.headers.get('location');
  };
  expect(await exit('')).toBe('http://localhost:3000/cuenta/panel/');
  expect(await exit('?ruta=/propuestas/agua/')).toBe('http://localhost:3000/propuestas/agua/');
  for (const ruta of ['//otro.sitio/', '/\\otro.sitio', 'https://otro.sitio/', 'propuestas'])
    expect(await exit(`?ruta=${encodeURIComponent(ruta)}`)).toBe('http://localhost:3000/cuenta/panel/');
});
