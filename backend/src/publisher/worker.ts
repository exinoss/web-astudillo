// `bun run publicador`: toma la publicación en cola, compila el sitio estático con ese contenido
// y, si sale bien, cambia el enlace `actual` que sirve nginx. Si falla, el sitio anterior sigue.
import { SQL } from 'bun';
import { mkdir, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { callPg } from '../db/call';

const POLL_MS = 3000;
const KEEP_RELEASES = 5;
const LOG_LINES = 30;

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');
const frontendDir = resolve(process.env.FRONTEND_DIR ?? '../frontend');
const siteDir = resolve(process.env.SITE_DIR ?? '../sitio');
const releasesDir = join(siteDir, 'releases');
const sql = new SQL(url);

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Apunta `actual` a la nueva versión: en Linux con un rename atómico; en Windows con una unión. */
async function activate(releaseDir: string) {
  const current = join(siteDir, 'actual');
  if (process.platform === 'win32') {
    await rm(current, { recursive: false, force: true }).catch(() => {});
    await symlink(releaseDir, current, 'junction');
    return;
  }
  const next = join(siteDir, 'actual-nuevo');
  await rm(next, { force: true });
  await symlink(releaseDir, next);
  await rename(next, current);
}

/** Borra las versiones antiguas, conservando las últimas y la que está en línea. */
async function prune(keep: string) {
  const entries = (await readdir(releasesDir, { withFileTypes: true }))
    .filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => Number(b) - Number(a));
  for (const name of entries.slice(KEEP_RELEASES))
    if (join(releasesDir, name) !== keep) await rm(join(releasesDir, name), { recursive: true, force: true });
}

async function build(id: number, content: unknown) {
  const releaseDir = join(releasesDir, String(id));
  const contentFile = join(releasesDir, `${id}.json`);
  await mkdir(releasesDir, { recursive: true });
  await writeFile(contentFile, JSON.stringify(content));
  const started = Date.now();
  const proc = Bun.spawn(['bun', 'run', 'build'], {
    cwd: frontendDir, stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, CONTENT_FILE: contentFile, ASTRO_OUT_DIR: releaseDir },
  });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  await rm(contentFile, { force: true });
  const log = `${out}\n${err}`.trim().split('\n').slice(-LOG_LINES).join('\n');
  if (code !== 0) {
    await rm(releaseDir, { recursive: true, force: true });
    await callPg(sql, 'publicationFinish', [id, false, log]);
    console.error(`Publicación ${id} falló (código ${code})`);
    return;
  }
  await activate(releaseDir);
  await prune(releaseDir);
  await callPg(sql, 'publicationFinish', [id, true, `Compilada en ${Math.round((Date.now() - started) / 1000)} s`]);
  console.log(`Publicación ${id} en línea`);
}

await callPg(sql, 'publicationRecover');
console.log(`Publicador listo: compila ${frontendDir} en ${releasesDir}`);
for (;;) {
  try {
    const [job] = await callPg<{ id_publicacion: number; contenido: unknown }>(sql, 'publicationClaim');
    if (!job) {
      await wait(POLL_MS);
      continue;
    }
    // Un fallo inesperado (disco, proceso que no arranca) también marca la publicación como fallida.
    await build(job.id_publicacion, job.contenido).catch(async (error: unknown) => {
      for (const leftover of [String(job.id_publicacion), `${job.id_publicacion}.json`])
        await rm(join(releasesDir, leftover), { recursive: true, force: true }).catch(() => {});
      await callPg(sql, 'publicationFinish', [job.id_publicacion, false, error instanceof Error ? error.message : String(error)]);
      console.error(`Publicación ${job.id_publicacion} falló:`, error);
    });
  } catch (error) {
    console.error('Error del publicador:', error instanceof Error ? error.message : error);
    await wait(POLL_MS);
  }
}
