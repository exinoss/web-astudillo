import { afterAll, beforeAll, expect, test } from 'bun:test';
import { migrate } from '../src/db/migrate';
import { testApp } from './helpers';

const { sql, app, config, call, account, resetAccounts } = testApp('medios-pruebas-cifras', true);
const CHROME = 'Mozilla/5.0 (Linux; Android 13; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const visit = (visitante: unknown, ip = '203.0.113.7', agente = CHROME) => app.handle(new Request(`${config.origin}/api/visitas`, {
  method: 'POST', body: JSON.stringify({ visitante }),
  headers: { origin: config.origin, 'content-type': 'application/json', 'x-real-ip': ip, 'user-agent': agente },
}));
const navegador = () => crypto.randomUUID().replaceAll('-', '');
const total = async () => Number((await sql`SELECT COALESCE(sum(total), 0) AS n FROM tb_visitas_dia`)[0].n);
const inactivo = (minutos: number) => sql`UPDATE tb_visitantes_activos SET ultima_actividad = now() - make_interval(mins => ${minutos})`;

beforeAll(async () => {
  await migrate(sql);
  await resetAccounts();
  await sql`TRUNCATE tb_visitas_dia, tb_visitantes_activos`;
  for (const [nombre, rol] of [['ana', 'votante'], ['luis', 'votante'], ['bloqueada', 'votante'], ['equipo', 'coadmin'], ['jefa', 'admin']])
    await account(nombre, rol);
  await sql`UPDATE tb_usuarios SET estado = 'bloqueado' WHERE correo = 'bloqueada@example.com'`;
});
afterAll(() => sql.close());

test('varios navegadores con la misma IP cuentan por separado, y no se guarda la IP ni el identificador', async () => {
  const [a, b, c] = [navegador(), navegador(), navegador()];
  for (const id of [a, b, c]) expect((await visit(id)).status).toBe(204);
  expect(await total()).toBe(3);
  const filas = await sql`SELECT * FROM tb_visitantes_activos`;
  expect(Object.keys(filas[0]).sort()).toEqual(['ultima_actividad', 'visitante']);
  expect(filas.map((f: { visitante: string }) => f.visitante)).not.toContain(a);
  const columnas = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'tb_visitas_dia'`;
  expect(columnas.map((c: { column_name: string }) => c.column_name).sort()).toEqual(['dia', 'total']);
});

test('recargas, pestañas a la vez y reintentos del mismo navegador cuentan una sola visita', async () => {
  const antes = await total();
  const id = navegador();
  expect((await Promise.all(Array.from({ length: 6 }, () => visit(id)))).every((r) => r.status === 204)).toBe(true);
  await visit(id);
  await visit(id, '198.51.100.20');
  expect(await total()).toBe(antes + 1);
});

test('vuelve a contar tras 30 minutos sin actividad; la actividad reciente alarga la misma visita', async () => {
  const id = navegador();
  await visit(id);
  const antes = await total();
  await inactivo(20);
  await visit(id);
  expect(await total()).toBe(antes);
  await inactivo(29);
  await visit(id);
  expect(await total()).toBe(antes);
  await inactivo(31);
  await visit(id);
  expect(await total()).toBe(antes + 1);
  await visit(id);
  expect(await total()).toBe(antes + 1);
});

test('lo inactivo hace más de 30 minutos se borra', async () => {
  await inactivo(45);
  await visit(navegador());
  expect(Number((await sql`SELECT count(*) AS n FROM tb_visitantes_activos`)[0].n)).toBe(1);
});

test('robots, peticiones sin navegador e identificadores inválidos no cuentan', async () => {
  const antes = await total();
  expect((await visit(navegador(), '203.0.113.7', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).status).toBe(204);
  expect((await visit(navegador(), '203.0.113.7', 'Mozilla/5.0 HeadlessChrome/130.0')).status).toBe(204);
  expect((await visit(navegador(), '203.0.113.7', '')).status).toBe(204);
  expect((await visit('no-es-un-identificador')).status).toBe(422);
  expect((await call('/api/visitas', 'POST', undefined, undefined, '203.0.113.7')).status).toBe(422);
  expect(await total()).toBe(antes);
});

test('una IP suma como mucho 120 visitas nuevas por hora; las demás IP no se ven afectadas', async () => {
  const antes = await total();
  for (let i = 0; i < 125; i++) await visit(navegador(), '192.0.2.50');
  expect(await total()).toBe(antes + 120);
  await visit(navegador(), '192.0.2.51');
  expect(await total()).toBe(antes + 121);
});

test('las cifras públicas suman visitas, voces ciudadanas y personas que se sumaron, sin el equipo', async () => {
  const [{ voces }] = await sql`SELECT (SELECT count(*) FROM tb_alertas) + (SELECT count(*) FROM tb_sugerencias)
    + (SELECT count(*) FROM tb_chat_envios) AS voces`;
  const res = await call('/api/estadisticas');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ visitas: await total(), voces: Number(voces), personas: 2 });
});

test('el día se cuenta en la hora de Ecuador', async () => {
  const [{ hoy }] = await sql`SELECT ((now() AT TIME ZONE 'America/Guayaquil')::date)::text AS hoy`;
  const [{ dia }] = await sql`SELECT dia::text AS dia FROM tb_visitas_dia`;
  expect(dia).toBe(hoy);
});
