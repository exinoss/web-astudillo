import initial from '../../../../../backend/database/contenido-inicial.json';
import { SnapshotRepository, type Snapshot } from '../snapshot-repository';
import type { AboutCarlosSlug } from '../types';
import { aboutCarlosPages } from './acerca-de-carlos';
import { fotoDePrueba } from './fotos';
import { miEquipo } from './mi-equipo';

// Las pruebas aisladas usan la semilla tal cual; «Agua potable» y el carrusel del equipo llevan fotos para probar sus carruseles.
export class MockContentRepository extends SnapshotRepository {
  protected async load(): Promise<Snapshot> {
    return { ...initial, version:1, originales:initial.textos, obras:initial.obras.map(o => o.slug !== 'agua-potable' ? o
      : { ...o, fotos:[1, 2, 3].map(n => ({ ...fotoDePrueba(n), pie:`Foto de prueba ${n}` })) }), miEquipo,
      inicio:{ ...initial.inicio, equipo:{ fotos:[1, 2].map(n => ({ foto:fotoDePrueba(70 + n), alt:`Foto del equipo de prueba ${n}` })) } } as Snapshot["inicio"] };
  }
  async getAboutCarlosPage(slug: AboutCarlosSlug) { return aboutCarlosPages[slug]; }
}
