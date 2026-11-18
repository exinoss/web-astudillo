import { videosDePagina } from '../../../../backend/src/contracts/acerca-de-carlos';
import type { AboutCarlosPage, UploadedPicture } from './types';

type ApiVideo<F> = { titulo: string; descripcion: string | null; enlace: string; vertical: boolean; portada: F | null };

/** Forma de una página de Carlos en la API: la misma en el contenido publicado y en el borrador, donde las fotos llevan además `idMedio`. */
export interface ApiAboutCarlosPage<F extends UploadedPicture = UploadedPicture> {
  videos: ApiVideo<F>[];
  video?: ApiVideo<F> | null;
  entrevista: { pregunta: string; respuesta: string }[];
  galeria: { foto: F; alt: string; pie: string }[];
}

export const toAboutCarlosPage = (page?: ApiAboutCarlosPage): AboutCarlosPage => ({
  videos: videosDePagina(page).map(v => ({ title: v.titulo, description: v.descripcion, url: v.enlace, vertical: v.vertical, cover: v.portada })),
  interview: (page?.entrevista ?? []).map(e => ({ question: e.pregunta, answer: e.respuesta })),
  gallery: (page?.galeria ?? []).map(g => ({ image: g.foto, alt: g.alt, caption: g.pie })),
});
