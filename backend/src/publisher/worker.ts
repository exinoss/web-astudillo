// `bun run publicador`: toma la publicación en cola y ejecuta `bun run build` del frontend, que deja
// `<SITE_DIR>/dist` con ese contenido (en local, `frontend/dist`; en producción, el volumen que sirve
// nginx). La compilación lo lee de GET /api/contenido/publicado, que mientras dura el proceso devuelve
// justo esta publicación; si falla, `dist` y la API siguen con la anterior.
import { SQL } from 'bun';
import { cp, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { callPg } from '../db/call';

const POLL_MS = 3000;
const LOG_LINES = 30;

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');
const frontendDir = resolve(process.env.FRONTEND_DIR ?? '../frontend');
// dist, dist-nueva y dist-anterior viven en el mismo disco o volumen: el cambio final es un rename atómico.
const siteDir = resolve(process.env.SITE_DIR ?? frontendDir);
const sql = new SQL(url);

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const dist = join(siteDir, 'dist');
const next = join(siteDir, 'dist-nueva');
const previous = join(siteDir, 'dist-anterior');
// Astro mueve archivos desde su caché (frontend/.astro) a la salida: compila en el mismo disco que ella.
const buildDir = join(frontendDir, 'dist-nueva');

/** Reemplaza `dist` por la compilación nueva; hasta ese momento `dist` queda intacto. */
async function swap() {
  await rm(previous, { recursive: true, force: true });
  await rename(dist, previous).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await rename(next, dist);
  await rm(previous, { recursive: true, force: true });
}

/**
 * Compila en `dist-nueva` (Astro vacía su carpeta de salida al empezar) y solo si sale bien la pasa a `dist`.
 * Si el sitio se sirve desde otro disco (el volumen de nginx), primero copia la compilación a ese disco.
 */
async function build(id: number) {
  const started = Date.now();
  await rm(buildDir, { recursive: true, force: true });
  const proc = Bun.spawn(['bun', 'run', 'build', '--outDir', buildDir], { cwd: frontendDir, stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) {
    await rm(buildDir, { recursive: true, force: true });
    const log = `${out}\n${err}`.trim().split('\n').slice(-LOG_LINES).join('\n');
    await callPg(sql, 'publicationFinish', [id, false, log]);
    console.error(`Publicación ${id} falló (código ${code}):\n${log}`);
    return;
  }
  if (buildDir !== next) {
    await rm(next, { recursive: true, force: true });
    await cp(buildDir, next, { recursive: true });
    await rm(buildDir, { recursive: true, force: true });
  }
  await swap();
  await callPg(sql, 'publicationFinish', [id, true, `Compilada en ${Math.round((Date.now() - started) / 1000)} s`]);
  console.log(`Publicación ${id} compilada en ${dist}`);
}

await callPg(sql, 'publicationRecover');
console.log(`Publicador listo: compila ${frontendDir}`);
for (;;) {
  try {
    const [job] = await callPg<{ id_publicacion: number }>(sql, 'publicationClaim');
    if (!job) {
      await wait(POLL_MS);
      continue;
    }
    // Un fallo inesperado (el proceso no arranca, disco) también marca la publicación como fallida.
    await build(job.id_publicacion).catch(async (error: unknown) => {
      await callPg(sql, 'publicationFinish', [job.id_publicacion, false, error instanceof Error ? error.message : String(error)]);
      console.error(`Publicación ${job.id_publicacion} falló:`, error);
    });
  } catch (error) {
    console.error('Error del publicador:', error instanceof Error ? error.message : error);
    await wait(POLL_MS);
  }
}
