import type { ImageMetadata } from 'astro';
import initial from '../../../../../backend/database/contenido-inicial.json';
import fotos from './fotos.json';
import { SnapshotRepository, type Snapshot } from '../snapshot-repository';
import type { AboutCarlosSlug } from '../types';
import { aboutCarlosPages } from './acerca-de-carlos';

// Las pruebas aisladas reutilizan la semilla; las fotos locales nunca son un respaldo de la API.
const photos = import.meta.glob<ImageMetadata>('../../../assets/{biografia,obras}/*.png', { eager: true, import: 'default' });
export class MockContentRepository extends SnapshotRepository {
  protected async load(): Promise<Snapshot> { return { ...initial, version:1, originales:initial.textos }; }
  async getBiography() {
    return (await super.getBiography()).map((h,i) => ({ ...h, image:photos['../../../assets/biografia/hito-' + (i+1) + '.png'] ?? null }));
  }
  async getWorks() {
    return (await super.getWorks()).map(w => ({ ...w, evidence:Object.entries(photos)
      .filter(([path]) => path.includes('/obras/' + w.proposalSlug + '-')).sort(([a],[b]) => a.localeCompare(b))
      .map(([,image],i) => ({ image, alt:initial.propuestas.find(p => p.slug === w.proposalSlug)!.nombre + ': foto ' + (i+1), caption:fotos.pie + ' ' + (i+1) })) }));
  }
  async getAboutCarlosPage(slug: AboutCarlosSlug) { return aboutCarlosPages[slug]; }
}
