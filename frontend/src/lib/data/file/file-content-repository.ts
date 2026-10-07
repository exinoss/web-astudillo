import { readFile } from 'node:fs/promises';
import { SnapshotRepository, type Snapshot } from '../snapshot-repository';

export class FileContentRepository extends SnapshotRepository {
  #snapshot?: Promise<Snapshot>;
  constructor(private readonly path: string) { super(); }
  protected load() {
    this.#snapshot ??= readFile(this.path, 'utf8').then(text => JSON.parse(text) as Snapshot);
    return this.#snapshot;
  }
}
