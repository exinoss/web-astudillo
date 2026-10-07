import { cp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

interface Output { dist: string; next: string; previous: string }
const ASSET_RETENTION_MS = 7 * 86_400_000;
const ASSET_MANIFEST = '.recursos-retenidos.json';

async function exists(path: string) {
  return stat(path).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
}

async function preserveAssets(dist: string, next: string) {
  const assets = join(next, '_astro');
  if (!await exists(assets)) return;
  const oldAssets = join(dist, '_astro');
  if (!await exists(oldAssets)) return;
  const manifest = join(dist, ASSET_MANIFEST);
  const retained: Record<string, number> = await exists(manifest) ? JSON.parse(await readFile(manifest, 'utf8')) : {};
  const remaining: Record<string, number> = Object.create(null);
  const now = Date.now();
  // Una pestaña abierta conserva las URL con hash de su HTML; las descargas diferidas deben seguir disponibles.
  await cp(oldAssets, assets, {
    recursive: true, force: false, errorOnExist: false, preserveTimestamps: true,
    filter: async (source, destination) => {
      const file = await stat(source);
      if (file.isDirectory()) return true;
      if (await exists(destination)) return false;
      const name = relative(oldAssets, source);
      // Se cuenta desde que deja de usarse, no desde el mtime de la caché de Astro ni desde cada copia.
      const retiredAt = Number.isFinite(retained[name]) ? retained[name] : now;
      if (retiredAt < now - ASSET_RETENTION_MS) return false;
      remaining[name] = retiredAt;
      return true;
    },
  });
  await writeFile(join(next, ASSET_MANIFEST), JSON.stringify(remaining));
}

// En Windows el antivirus o el indexador pueden bloquear momentáneamente un rename.
async function renameRetrying(from: string, to: string) {
  for (let attempt = 1; ; attempt++) {
    try { return await rename(from, to); }
    catch (error) {
      if (attempt >= 10 || !['EPERM', 'EBUSY', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
}

export async function swap({ dist, next, previous }: Output) {
  await stat(next);
  await preserveAssets(dist, next);
  await rm(previous, { recursive: true, force: true });
  await renameRetrying(dist, previous).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  try { await renameRetrying(next, dist); }
  catch (error) {
    await renameRetrying(previous, dist).catch(() => {});
    throw error;
  }
  await rm(previous, { recursive: true, force: true });
}
