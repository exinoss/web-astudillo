import { afterAll, beforeAll, expect, test } from 'bun:test';
import { migrate } from '../src/db/migrate';
import { testApp } from './helpers';

const { sql, call } = testApp('medios-pruebas-cifras', true);
const visit = (ip: string) => call('/api/visitas', 'POST', undefined, undefined, ip);
const total = async () => Number((await sql`SELECT COALESCE(sum(total), 0) AS n FROM tb_visitas_dia`)[0].n);

beforeAll(async () => {
  await migrate(sql);
  await sql`TRUNCATE tb_visitas_dia`;
});
afterAll(() => sql.close());

test('una visita cuenta una vez aunque se repita desde la misma conexión, y no guarda la IP', async () => {
  expect((await visit('203.0.113.7')).status).toBe(204);
  expect((await visit('203.0.113.7')).status).toBe(204);
  expect(await total()).toBe(1);
  expect((await visit('198.51.100.20')).status).toBe(204);
  expect(await total()).toBe(2);
  const columns = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'tb_visitas_dia'`;
  expect(columns.map((c: { column_name: string }) => c.column_name).sort()).toEqual(['dia', 'total']);
});

test('las cifras públicas suman las visitas y las voces ciudadanas', async () => {
  const [{ voces }] = await sql`SELECT (SELECT count(*) FROM tb_alertas) + (SELECT count(*) FROM tb_sugerencias)
    + (SELECT count(*) FROM tb_chat_envios) AS voces`;
  const res = await call('/api/estadisticas');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ visitas: 2, voces: Number(voces) });
});

test('el día se cuenta en la hora de Ecuador', async () => {
  const [{ hoy }] = await sql`SELECT ((now() AT TIME ZONE 'America/Guayaquil')::date)::text AS hoy`;
  const [{ dia }] = await sql`SELECT dia::text AS dia FROM tb_visitas_dia`;
  expect(dia).toBe(hoy);
});
