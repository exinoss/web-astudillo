import { expect, test } from 'bun:test';
import { ipOf } from '../src/auth/routes/common';

const server = { requestIP: (_request: Request) => ({ address: '172.18.0.2' }) };

test('solo confía en X-Real-IP cuando el proxy está habilitado', () => {
  const request = new Request('http://localhost/api/auth/login', {
    headers: { 'x-real-ip': '203.0.113.10' },
  });
  expect(ipOf(server, request)).toBe('172.18.0.2');
  expect(ipOf(server, request, true)).toBe('203.0.113.10');
});

test('descarta direcciones inválidas aunque el proxy esté habilitado', () => {
  const request = new Request('http://localhost/api/auth/login', {
    headers: { 'x-real-ip': '203.0.113.10, 198.51.100.4' },
  });
  expect(ipOf(server, request, true)).toBe('172.18.0.2');
});
