import initial from '../../../../../backend/database/contenido-inicial.json';
import { SnapshotRepository, type Snapshot } from '../snapshot-repository';
import type { AboutCarlosSlug } from '../types';
import { aboutCarlosPages } from './acerca-de-carlos';
import { fotoDePrueba } from './fotos';
import { miEquipo } from './mi-equipo';

// Las pruebas aisladas usan la semilla tal cual; solo «Agua potable» lleva fotos para probar el carrusel de Obras.
export class MockContentRepository extends SnapshotRepository {
  protected async load(): Promise<Snapshot> {
    return { ...initial, version:1, originales:initial.textos, obras:initial.obras.map(o => o.slug !== 'agua-potable' ? o
      : { ...o, fotos:[1, 2, 3].map(n => ({ ...fotoDePrueba(n), pie:`Foto de prueba ${n}` })) }), miEquipo, inicio:initial.inicio as Snapshot["inicio"] };
  }
  async getAboutCarlosPage(slug: AboutCarlosSlug) { return aboutCarlosPages[slug]; }
}
