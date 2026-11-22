import type { SQL } from 'bun';
import initial from '../../../database/contenido-inicial.json';
import { PERMISSIONS } from '../../auth/permissions';
import type { Authorization } from '../../auth/types';
import { AVISO_ENLACE_BOTON, AVISO_HORIZONTAL, AVISO_PIEZAS, enlaceBoton, MAX_IMAGENES_PIEZAS, MAX_VIDEOS_PIEZAS, type Carrusel } from '../../contracts/inicio';
import { LARGOS } from '../../contracts/limites';
import { callPg } from '../../db/call';
import { ApiError } from '../../http';
import { plainText } from '../../validation/texto';
import { existingPhotos, saved, type SaveRow } from '../guardado';
import type { HomeCarousels, HomeCarouselsStored, HomeImage, HomeImageStored, HomePiece, Photo } from '../types';
import { assertInsertable, cleanVideo } from '../videos';
import { photosById } from './media';
import { videoInsertable } from './video-cover';

type Stored = HomeCarouselsStored[Carrusel];

type HomeMainInput = HomeCarouselsStored['principal'];
type HomePiecesInput = HomeCarouselsStored['piezas'];
type HomeTeamInput = HomeCarouselsStored['equipo'];

/** Solo trae imágenes que vienen con el sitio: vale tal cual como contenido guardado y como publicado. */
export const HOME_CAROUSELS_SEED = initial.inicio as Pick<HomeCarousels & HomeCarouselsStored, 'principal' | 'piezas'>;

const BANNER_FIJO = 'portada';
/** Id de la foto subida de una imagen, si lo tiene. */
const ids = (image: HomeImageStored) => ('idMedio' in image ? [image.idMedio] : []);
/** Fotos que usa el carrusel principal: banners, sus versiones para celular y el retrato. */
const mainIds = ({ banners, retrato }: HomeMainInput) => [...banners.flatMap(b => [...ids(b.imagen), ...(b.celular ? [b.celular] : [])]), ...ids(retrato.imagen)];
/** Fotos que usa el carrusel de piezas: las imágenes subidas y las portadas de los videos. */
const piecesIds = ({ piezas }: HomePiecesInput) => piezas.flatMap(p => ('video' in p ? (p.video.idPortada ? [p.video.idPortada] : []) : ids(p.imagen)));
/** Imagen lista para mostrar, o null si su foto se borró. */
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
  const pieces = piezas.piezas.flatMap((p): HomePiece[] => {
    if ('video' in p) {
      const { idPortada, ...video } = p.video;
      return [{ video: { ...video, portada: idPortada ? media.get(idPortada) ?? null : null } }];
    }
    const image = resolve(p.imagen, media);
    return image ? [{ imagen: image, alt: p.alt }] : [];
  });
  return {
    principal: {
      banners: banners.length ? banners : HOME_CAROUSELS_SEED.principal.banners,
      retrato: portrait ? { imagen: portrait, alt: principal.retrato.alt } : HOME_CAROUSELS_SEED.principal.retrato,
      enlace: principal.enlace ?? HOME_CAROUSELS_SEED.principal.enlace,
    },
    piezas: { piezas: pieces.length ? pieces : HOME_CAROUSELS_SEED.piezas.piezas },
    equipo: { fotos: equipo.fotos.flatMap(({ idMedio, alt }) => { const foto = media.get(idMedio); return foto ? [{ foto, alt }] : []; }) },
  };
}

// Mismo orden de claves siempre: la versión es el md5 del contenido guardado.
const image = (value: HomeImageStored): HomeImageStored => ('original' in value ? { original: value.original } : { idMedio: value.idMedio });
/** Descripción de una imagen del carrusel, validada como texto plano. */
const alt = (value: string, field: string) => plainText(value, `${field} · descripción`, LARGOS.descripcionFoto);

/** Guarda los carruseles de la portada; `checkVideo` permite simular las plataformas de video en las pruebas. */
export function createHomeCarousels(sql: SQL, authorization: Authorization, checkVideo = videoInsertable) {
  async function save(actor: { id_usuario: number }, key: Carrusel, content: Stored, mediaIds: number[], version: string | null, horizontales = false) {
    const media = await existingPhotos(sql, mediaIds);
    if (horizontales && [...media.values()].some(f => f.ancho <= f.alto)) throw new ApiError(422, AVISO_HORIZONTAL);
    return saved(await callPg<SaveRow>(sql, 'homeCarouselsSave', [actor.id_usuario, key, content, version]));
  }

  return {
    async saveMain(access: string | undefined, input: HomeMainInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const primero = input.banners[0].imagen;
      if (!('original' in primero && primero.original === BANNER_FIJO)) throw new ApiError(422, 'El primer banner no se puede quitar ni mover.');
      const enlace = enlaceBoton(input.enlace ?? '');
      if (enlace === null) throw new ApiError(422, `Enlace del botón: ${AVISO_ENLACE_BOTON}`);
      const content: HomeMainInput = {
        // El banner 1 tiene su propia versión para celular en la portada.
        banners: input.banners.map((b, i) => ({ imagen: image(b.imagen), celular: i ? b.celular : null, alt: alt(b.alt, `Banner ${i + 1}`) })),
        retrato: { imagen: image(input.retrato.imagen), alt: alt(input.retrato.alt, 'Retrato') },
        enlace,
      };
      return save(actor, 'principal', content, mainIds(content), version);
    },

    async savePieces(access: string | undefined, input: HomePiecesInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const videos = input.piezas.filter(p => 'video' in p).length;
      if (videos > MAX_VIDEOS_PIEZAS || input.piezas.length - videos > MAX_IMAGENES_PIEZAS) throw new ApiError(422, AVISO_PIEZAS);
      const content: HomePiecesInput = {
        piezas: input.piezas.map((p, i) => {
          if (!('video' in p)) return { imagen: image(p.imagen), alt: alt(p.alt, `Pieza ${i + 1}`) };
          const { titulo, enlace, vertical, idPortada } = cleanVideo(p.video, `Pieza ${i + 1}`);
          return { video: { titulo, enlace, vertical, idPortada } };
        }),
      };
      await assertInsertable(content.piezas.flatMap((p, i) => ('video' in p ? [{ enlace: p.video.enlace, campo: `Pieza ${i + 1}` }] : [])), checkVideo);
      return save(actor, 'piezas', content, piecesIds(content), version);
    },

    async saveTeamPhotos(access: string | undefined, input: HomeTeamInput, version: string | null) {
      const actor = await authorization.require(access, PERMISSIONS.contentEdit);
      const content: HomeTeamInput = { fotos: input.fotos.map((f, i) => ({ idMedio: f.idMedio, alt: alt(f.alt, `Imagen ${i + 1}`) })) };
      return save(actor, 'equipo', content, content.fotos.map(f => f.idMedio), version, true);
    },
  };
}
