import { SnapshotRepository, type Snapshot } from '../snapshot-repository';

const API = globalThis.process?.env.API_PROXY_TARGET || 'http://127.0.0.1:3000';
const DEV_TTL_MS = 1000;

export class HttpContentRepository extends SnapshotRepository {
  #snapshot?: Promise<Snapshot>;
  #loadedAt = 0;
  protected load() {
    if (this.#snapshot && !(import.meta.env.DEV && Date.now() - this.#loadedAt > DEV_TTL_MS)) return this.#snapshot;
    this.#loadedAt = Date.now();
    this.#snapshot = fetch(API + '/api/contenido/publicado', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('No se pudo leer el contenido publicado (' + response.status + ')');
      const data = await response.json() as Snapshot;
      if (data.version !== 1) throw new Error('Versión de contenido no soportada: ' + data.version);
      return data;
    });
    this.#snapshot.catch(() => { this.#snapshot = undefined; });
    return this.#snapshot;
  }
}
