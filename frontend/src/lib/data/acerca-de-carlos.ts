import type { AboutCarlosPage, CardColor, UploadedPicture } from './types';

/** Forma de una página de Carlos en la API: la misma en el contenido publicado y en el borrador, donde las fotos llevan además `idMedio`. */
export interface ApiAboutCarlosPage<F extends UploadedPicture = UploadedPicture> {
  tarjetas: { foto: F; alt: string; titulo: string; texto: string; color: CardColor; enfoque: { x: number; y: number } }[];
  video: { titulo: string; descripcion: string | null; enlace: string; vertical: boolean; portada: F | null } | null;
  retrato: { foto: F; alt: string } | null;
  entrevista: { pregunta: string; respuesta: string }[];
  galeria: { foto: F; alt: string; pie: string }[];
}

export const toAboutCarlosPage = (page?: ApiAboutCarlosPage): AboutCarlosPage => ({
  cards: (page?.tarjetas ?? []).map(t => ({ title: t.titulo, text: t.texto, image: t.foto, alt: t.alt, color: t.color, focus: t.enfoque })),
  video: page?.video ? { title: page.video.titulo, description: page.video.descripcion, url: page.video.enlace,
    vertical: page.video.vertical, cover: page.video.portada } : null,
  portrait: page?.retrato ? { image: page.retrato.foto, alt: page.retrato.alt } : null,
  interview: (page?.entrevista ?? []).map(e => ({ question: e.pregunta, answer: e.respuesta })),
  gallery: (page?.galeria ?? []).map(g => ({ image: g.foto, alt: g.alt, caption: g.pie })),
});
