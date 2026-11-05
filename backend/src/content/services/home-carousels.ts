import type { SQL } from 'bun';
import initial from '../../../database/contenido-inicial.json';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { AVISO_HORIZONTAL, type Carrusel } from '../../contracts/inicio';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import { plainText } from '../../validation/texto';
import { CONTENT_CONFLICT } from '../conflictos';
import type { HomeCarousels, HomeCarouselsStored, HomeImage, HomeImageStored, Photo } from '../types';
import { photosById } from './media';

type SaveRow = { resultado: 'guardado' | 'sin_cambios' | 'conflicto'; version: string | null };
type Stored = HomeCarouselsStored[Carrusel];

export type HomeMainInput = HomeCarouselsStored['principal'];
export type HomePiecesInput = HomeCarouselsStored['piezas'];
export type HomeTeamInput = HomeCarouselsStored['equipo'];

/** Solo trae imágenes que vienen con el sitio: vale tal cual como contenido guardado y como publicado. */
export const HOME_CAROUSELS_SEED = initial.inicio as Pick<HomeCarousels & HomeCarouselsStored, 'principal' | 'piezas'>;

const ids = (image: HomeImageStored) => ('idMedio' in image ? [image.idMedio] : []);
const mainIds = ({ banners, retrato }: HomeMainInput) => [...banners.flatMap(b => [...ids(b.imagen), ...(b.celular ? [b.celular] : [])]), ...ids(retrato.imagen)];
const piecesIds = ({ piezas }: HomePiecesInput) => piezas.flatMap(p => ids(p.imagen));
const resolve = (image: HomeImageStored, media: Map<number, Photo>): HomeImage | null =>
  'original' in image ? { original: image.original } : media.has(image.idMedio) ? { foto: media.get(image.idMedio)! } : null;

/** Carruseles de la portada sin las fotos borradas; el principal o el de piezas, si quedan vacíos, vuelven a la semilla. */
export async function listHomeCarousels(sql: SQL): Promise<HomeCarousels> {
  const rows = new Map((await callPg<{ clave: Carrusel; contenido: Stored }>(sql, 'homeCarouselsList')).map(r => [r.clave, r.contenido]));
  const principal = (rows.get('principal') ?? HOME_CAROUSELS_SEED.principal) as HomeMainInput;
  const piezas = (rows.get('piezas') ?? HOME_CAROUSELS_SEED.piezas) as HomePiecesInput;
  const equipo = (rows.get('equipo') ?? { fotos: [] }) as HomeTeamInput;
  const media = await photosById(sql, [...mainIds(principal), ...piecesIds(piezas), ...equipo.fotos.map(f => f.idMedio)]);
  const banners = principal.banners.flatMap(({ imagen, celular, alt }) => {
    const image = resolve(imagen, media);
    return image ? [{ imagen: image, celular: celular ? media.get(celular) ?? null : null, alt }] : [];
  });
  const portrait = resolve(principal.retrato.imagen, media);
  const pieces = piezas.piezas.flatMap(({ imagen, alt }) => {
    const image = resolve(imagen, media);
    return image ? [{ imagen: image, alt }] : [];
  });
  return {
    principal: {
      banners: banners.length ? banners : HOME_CAROUSELS_SEED.principal.banners,
      retrato: portrait ? { imagen: portrait, alt: principal.retrato.alt } : HOME_CAROUSELS_SEED.principal.retrato,
    },
    piezas: { piezas: pieces.length ? pieces : HOME_CAROUSELS_SEED.piezas.piezas },
    equipo: { fotos: equipo.fotos.flatMap(({ idMedio, alt }) => { const foto = media.get(idMedio); return foto ? [{ foto, alt }] : []; }) },
  };
}

// Mismo orden de claves siempre: la versión es el md5 del contenido guardado.
const image = (value: HomeImageStored): HomeImageStored => ('original' in value ? { original: value.original } : { idMedio: value.idMedio });
const alt = (value: string, field: string) => plainText(value, `${field} · descripción`, 200);

export function createHomeCarousels(sql: SQL, authorization: Authorization) {
  async function save(actor: { id_usuario: number }, key: Carrusel, content: Stored, mediaIds: number[], version: string | null, horizontales = false) {
    const media = await photosById(sql, mediaIds);
    if (mediaIds.some(id => !media.has(id))) throw new ApiError(422, 'Alguna foto ya no existe; vuelve a subirla');
    if (horizontales && [...media.values()].some(f => f.ancho <= f.alto)) throw new ApiError(422, AVISO_HORIZONTAL);
    const [row] = await callPg<SaveRow>(sql, 'homeCarouselsSave', [actor.id_usuario, key, content, version]);
    if (!row) throw new ApiError(404, 'No encontrado');
    if (row.resultado === 'conflicto') throw new ApiError(409, CONTENT_CONFLICT);
    return { version: row.version };
  }

  return {
    async saveMain(access: string | undefined, input: HomeMainInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const content: HomeMainInput = {
        banners: input.banners.map((b, i) => ({ imagen: image(b.imagen), celular: b.celular, alt: alt(b.alt, `Banner ${i + 1}`) })),
        retrato: { imagen: image(input.retrato.imagen), alt: alt(input.retrato.alt, 'Retrato') },
      };
      return save(actor, 'principal', content, mainIds(content), version);
    },

    async savePieces(access: string | undefined, input: HomePiecesInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const content: HomePiecesInput = { piezas: input.piezas.map((p, i) => ({ imagen: image(p.imagen), alt: alt(p.alt, `Pieza ${i + 1}`) })) };
      return save(actor, 'piezas', content, piecesIds(content), version);
    },

    async saveTeamPhotos(access: string | undefined, input: HomeTeamInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const content: HomeTeamInput = { fotos: input.fotos.map((f, i) => ({ idMedio: f.idMedio, alt: alt(f.alt, `Imagen ${i + 1}`) })) };
      return save(actor, 'equipo', content, content.fotos.map(f => f.idMedio), version, true);
    },
  };
}
