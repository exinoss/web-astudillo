import initial from '../../../../../backend/database/contenido-inicial.json';
import { SnapshotRepository, type Snapshot } from '../snapshot-repository';
import type { AboutCarlosSlug } from '../types';
import { aboutCarlosPages } from './acerca-de-carlos';
import { fotoDePrueba } from './fotos';
import { miEquipo } from './mi-equipo';

// Las pruebas aisladas usan la semilla tal cual; «Agua potable» y el carrusel del equipo llevan fotos para probar sus carruseles,
// y «Mercado municipal», una foto y dos videos.
export class MockContentRepository extends SnapshotRepository {
  protected async load(): Promise<Snapshot> {
    return { ...initial, version:1, originales:initial.textos, obras:initial.obras.map(o => o.slug === 'agua-potable' ? { ...o, fotos:[1, 2, 3].map(n => ({ ...fotoDePrueba(n), pie:`Foto de prueba ${n}` })) }
      : o.slug === 'mercado-municipal' ? { ...o, fotos:[{ ...fotoDePrueba(4), pie:'Foto de prueba 4' },
        { video:{ enlace:'https://www.youtube.com/watch?v=dQw4w9WgXcQ', vertical:false, portada:fotoDePrueba(5) }, pie:'Recorrido por el mercado' },
        { video:{ enlace:'https://www.tiktok.com/@scout2015/video/6718335390845095173', vertical:true, portada:null }, pie:'Así avanza el mercado' }] }
      : o), miEquipo,
      inicio:{ ...initial.inicio, equipo:{ fotos:[1, 2].map(n => ({ foto:fotoDePrueba(70 + n), alt:`Foto del equipo de prueba ${n}` })) } } as Snapshot["inicio"] };
  }
  async getAboutCarlosPage(slug: AboutCarlosSlug) { return aboutCarlosPages[slug]; }
}
