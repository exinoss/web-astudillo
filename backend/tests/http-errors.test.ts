import { expect, test } from 'bun:test';
import type { SQL } from 'bun';
import { createApp } from '../src/app';
import type { Config } from '../src/config';
import { ApiError } from '../src/http';
import { mapHttpError } from '../src/http-errors';
import type { Security } from '../src/security';

const origin = 'http://localhost:3000';
const app = createApp({
  sql: {} as SQL,
  config: { origin, production: false, trustProxyIp: false } as Config,
  mailer: { async send() {} },
  security: {} as Security,
});

test('distingue ruta ausente, validación y JSON inválido', async () => {
  const missing = await app.handle(new Request(`${origin}/api/auth/google`));
  expect(missing.status).toBe(404);
  expect((await missing.json()).error).toContain('dirección y método');

  const invalid = await app.handle(new Request(`${origin}/api/auth/google`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}',
  }));
  expect(invalid.status).toBe(422);

  const malformed = await app.handle(new Request(`${origin}/api/auth/google`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{',
  }));
  expect(malformed.status).toBe(400);
});

test('distingue errores de negocio, conflictos, conexión y fallos inesperados', () => {
  expect(mapHttpError(new ApiError(401, 'Inicia sesión'), 'UNKNOWN')).toEqual({
    status: 401, message: 'Inicia sesión',
  });
  expect(mapHttpError({ errno: '23505' }, 'UNKNOWN').status).toBe(409);
  expect(mapHttpError({ code: 'ERR_POSTGRES_CONNECTION_CLOSED' }, 'UNKNOWN').status).toBe(503);
  expect(mapHttpError({ errno: '08006' }, 'UNKNOWN').status).toBe(503);
  const unexpected = mapHttpError(new Error('dato privado'), 'UNKNOWN');
  expect(unexpected.status).toBe(500);
  expect(unexpected.message).not.toContain('dato privado');
});
