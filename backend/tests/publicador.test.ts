import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { swap } from '../src/publisher/salida-estatica';

let root: string;
let output: { dist: string; next: string; previous: string };
const prefix = join(tmpdir(), 'astudillo-publicador-');

beforeEach(async () => {
  root = await mkdtemp(prefix);
  output = { dist: join(root, 'dist'), next: join(root, 'dist-nueva'), previous: join(root, 'dist-anterior') };
});
afterEach(async () => {
  if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !root.startsWith(prefix)) throw new Error('Carpeta de prueba inválida');
  await rm(root, { recursive: true, force: true });
});

async function build(folder: string, version: string) {
  await mkdir(join(folder, '_astro'), { recursive: true });
  await writeFile(join(folder, 'index.html'), version);
  await writeFile(join(folder, '_astro', `editor.${version}.js`), `export const version = '${version}';`);
}

test('las pestañas anteriores pueden descargar sus scripts después de varias publicaciones', async () => {
  await build(output.dist, 'uno');
  const old = new Date(Date.now() - 30 * 86_400_000);
  await utimes(join(output.dist, '_astro', 'editor.uno.js'), old, old);
  let retiredAt: number | undefined;
  for (const version of ['dos', 'tres']) {
    await build(output.next, version);
    await swap(output);
    expect(await readFile(join(output.dist, 'index.html'), 'utf8')).toBe(version);
    expect(await readFile(join(output.dist, '_astro', 'editor.uno.js'), 'utf8')).toContain("'uno'");
    const manifest = JSON.parse(await readFile(join(output.dist, '.recursos-retenidos.json'), 'utf8'));
    if (retiredAt) expect(manifest['editor.uno.js']).toBe(retiredAt);
    retiredAt = manifest['editor.uno.js'];
  }
});

test('retira los recursos vencidos y conserva los que la compilación todavía usa aunque su caché sea antigua', async () => {
  await build(output.dist, 'uno');
  const old = new Date(Date.now() - 8 * 86_400_000);
  await utimes(join(output.dist, '_astro', 'editor.uno.js'), old, old);
  await writeFile(join(output.dist, '.recursos-retenidos.json'), JSON.stringify({ 'editor.uno.js': old.getTime() }));
  await build(output.next, 'dos');
  const current = join(output.next, '_astro', 'editor.dos.js');
  await utimes(current, old, old);
  await swap(output);
  expect(await stat(join(output.dist, '_astro', 'editor.uno.js')).catch(() => null)).toBeNull();
  expect(await readFile(join(output.dist, '_astro', 'editor.dos.js'), 'utf8')).toContain("'dos'");
});

test('la retención no conserva archivos de borradores ni las páginas anteriores', async () => {
  await build(output.dist, 'uno');
  await build(output.next, 'dos');
  for (const [folder, version] of [[output.dist, 'uno'], [output.next, 'dos']]) {
    await mkdir(join(folder, '_astro-vista-previa'));
    await writeFile(join(folder, '_astro-vista-previa', `${version}.js`), version);
  }
  await writeFile(join(output.dist, 'solo-anterior.html'), 'anterior');
  await swap(output);
  expect(await stat(join(output.dist, '_astro-vista-previa', 'uno.js')).catch(() => null)).toBeNull();
  expect(await stat(join(output.dist, 'solo-anterior.html')).catch(() => null)).toBeNull();
  expect(await readFile(join(output.dist, '_astro-vista-previa', 'dos.js'), 'utf8')).toBe('dos');
});

test('una salida incompleta conserva el sitio anterior y la primera publicación también funciona', async () => {
  await build(output.dist, 'uno');
  await expect(swap(output)).rejects.toThrow();
  expect(await readFile(join(output.dist, 'index.html'), 'utf8')).toBe('uno');
  await rm(output.dist, { recursive: true });
  await build(output.next, 'dos');
  await swap(output);
  expect(await readFile(join(output.dist, 'index.html'), 'utf8')).toBe('dos');
});
