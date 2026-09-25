import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ApiError, apiRequest } from '../src/lib/data/http/api-client.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('dos peticiones protegidas comparten una sola renovación y se reintentan una vez', async () => {
  let profiles = 0;
  let refreshes = 0;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    assert.equal(init?.credentials, 'same-origin');
    if (path === '/api/auth/refresh') {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 20));
      return Response.json({ user: { id: 1 } });
    }
    assert.equal(path, '/api/me');
    profiles++;
    return profiles <= 2
      ? Response.json({ error: 'Inicia sesión' }, { status: 401 })
      : Response.json({ id: 1 });
  };
  const result = await Promise.all([
    apiRequest<{ id: number }>('/api/me', 'GET', undefined, true),
    apiRequest<{ id: number }>('/api/me', 'GET', undefined, true),
  ]);
  assert.deepEqual(result, [{ id: 1 }, { id: 1 }]);
  assert.equal(refreshes, 1);
  assert.equal(profiles, 4);
});

test('un inicio de sesión fallido no intenta renovar la sesión', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ error: 'Credenciales no válidas' }, { status: 401 });
  };
  await assert.rejects(
    apiRequest('/api/auth/login', 'POST', { correo: 'a@example.com', contrasenia: 'error' }),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(calls, 1);
});
