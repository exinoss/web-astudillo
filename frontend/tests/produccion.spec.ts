import { expect, test } from './support/prueba';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

let server: Server;
let origin: string;
let output: string;
let stats = { visitas: 240, voces: 18 };
let visits: string[] = [];
let fallosVisita = 0;
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const artifacts = resolve('test-results');
  await mkdir(artifacts, { recursive: true });
  output = await mkdtemp(join(artifacts, 'produccion-'));
  const initial = JSON.parse(await readFile('../backend/database/contenido-inicial.json', 'utf8'));
  // El modo de prueba sustituye este repositorio por un mock y ocultaría errores de las peticiones HTTP.
  server = createServer(async (request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    if (path.startsWith('/api/')) {
      response.setHeader('Content-Type', 'application/json');
      if (path === '/api/contenido/publicado') return response.end(JSON.stringify({ ...initial, version: 1, originales: initial.textos }));
      if (path === '/api/estadisticas') return response.end(JSON.stringify(stats));
      if (path === '/api/visitas' && request.method === 'POST') {
        let body = '';
        for await (const chunk of request) body += chunk;
        if (fallosVisita > 0) {
          fallosVisita--;
          response.writeHead(503).end();
          return;
        }
        visits.push(JSON.parse(body).visitante);
        response.writeHead(204).end();
        return;
      }
      response.writeHead(401).end('{"error":"Inicia sesión"}');
      return;
    }
    const file = resolve(output, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(output + sep)) return void response.writeHead(404).end();
    try {
      const data = await readFile(file);
      response.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
      response.end(data);
    } catch { response.writeHead(404).end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  await promisify(execFile)('bun', ['run', 'build', '--outDir', output], {
    env: { ...process.env, API_PROXY_TARGET: origin, CONTENIDO_ARCHIVO: '', ASTRO_TELEMETRY_DISABLED: '1' },
    timeout: 110_000,
  });
});

test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(ok => server.close(() => ok()));
  }
  if (output && output.startsWith(resolve('test-results') + sep)) await rm(output, { recursive: true, force: true });
});

test('los scripts de producción no contienen direcciones internas ni locales', async () => {
  const scripts = (await readdir(join(output, '_astro'))).filter(name => name.endsWith('.js'));
  expect(scripts.length).toBeGreaterThan(0);
  for (const file of scripts) {
    const code = await readFile(join(output, '_astro', file), 'utf8');
    expect(code, file).not.toMatch(/127\.0\.0\.1|\/\/localhost[:/]|192\.168\.\d|\/\/backend:/);
  }
});

test('la portada de producción actualiza las cifras y registra la visita en el propio sitio', async ({ page }) => {
  stats = { visitas: 3456, voces: 29 };
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.goto(origin);
  await page.locator('[data-cifras]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-cifra="visitas"]')).toHaveText('3.456');
  await expect(page.locator('[data-cifra="voces"]')).toHaveText('29');
  await expect.poll(() => visits.length).toBe(1);
  expect(visits[0]).toMatch(/^[a-f0-9]{32}$/);
  expect(requests).toContain(origin + '/api/estadisticas');
  expect(requests).toContain(origin + '/api/visitas');
  expect(requests.every(url => new URL(url).origin === origin)).toBe(true);
  await page.reload();
  await expect(page.locator('[data-cifra="visitas"]')).toHaveAttribute('data-valor', '240');
  await expect.poll(() => visits.length).toBe(2);
  expect(visits[1]).toBe(visits[0]);
  expect(errors).toEqual([]);
});

test('cada navegador tiene su identificador, sus pestañas lo comparten y un envío fallido se reintenta', async ({ browser }) => {
  visits = [];
  const dispositivos = await Promise.all([browser.newContext(), browser.newContext()]);
  for (const contexto of dispositivos) await contexto.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  const [a, b] = dispositivos;
  await (await a.newPage()).goto(origin);
  await (await b.newPage()).goto(origin);
  await expect.poll(() => visits.length).toBe(2);
  expect(visits[1]).not.toBe(visits[0]);
  fallosVisita = 1;
  await (await a.newPage()).goto(`${origin}/acerca-de-nosotros/biografia/`);
  await expect.poll(() => visits.length, { timeout: 10_000 }).toBe(3);
  expect(visits[2]).toBe(visits[0]);
  await Promise.all(dispositivos.map((c) => c.close()));
});

test('si falla la API de cifras, la portada de producción conserva las cifras publicadas', async ({ page }) => {
  await page.route('**/api/estadisticas', route => route.fulfill({ status: 503, body: 'No disponible' }));
  await page.goto(origin);
  await page.locator('[data-cifras]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-cifra="visitas"]')).toHaveText('240');
  await expect(page.locator('[data-cifra="voces"]')).toHaveText('18');
});

test('una respuesta inválida de cifras no deja errores sin manejar en la portada', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/estadisticas', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{' }));
  await page.goto(origin);
  await page.locator('[data-cifras]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-cifra="visitas"]')).toHaveText('240');
  await expect(page.locator('[data-cifra="voces"]')).toHaveText('18');
  expect(errors).toEqual([]);
});
