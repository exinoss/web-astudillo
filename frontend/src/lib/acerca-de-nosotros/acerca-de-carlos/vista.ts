import { getImage } from "astro:assets";
import portadaHorizontal from "../../../assets/portada.jpg";
import portadaVertical from "../../../assets/pieza-respeto-vertical.png";
import { texto } from "../../comun/contenido";
import type { TextKey } from "../../../../../backend/src/contracts/textos";
import { contentRepository } from "../../data";
import type { AboutCarlosSlug } from "../../data/types";
import { imageView, type ImageView } from "../../comun/fotos";
import { TARJETAS } from "./principios-valores";
import type { CardView } from "./tarjetas";

export interface AboutCarlosPageView {
  slug: AboutCarlosSlug;
  texts: Record<string, string>;
  cards: CardView[];
  videos: { title: string; description: string | null; url: string; vertical: boolean; cover: ImageView; medium: string | null }[];
  interview: { question: string; answer: string }[];
  gallery: { image: ImageView; alt: string; caption: string }[];
}

const TEXT_KEYS: Record<AboutCarlosSlug, TextKey[]> = {
  "por-que-quiero-ser-alcalde": ["alcalde.antetitulo", "alcalde.titulo", "alcalde.cita", "alcalde.nota", "alcalde.tarjetas"],
  "conoce-mas": ["conoce-mas.antetitulo", "conoce-mas.titulo", "conoce-mas.texto", "conoce-mas.tarjetas"],
};

/** Tarjetas fijas de la página, con su número y su texto como descripción. */
const fixedCards = (slug: AboutCarlosSlug): Promise<CardView[]> => Promise.all(TARJETAS[slug].map(async ({ imagen, texto }, i) => {
  const image = await getImage({ src: imagen, widths: [200, 260, 400, 520, 780] });
  return { src: image.src, srcset: image.srcSet.attribute, width: imagen.width, height: imagen.height, alt: `${i + 1}. ${texto}` };
}));

/** Imagen de la campaña para un video sin portada, en su formato. */
export async function defaultCover(vertical: boolean): Promise<ImageView> {
  const picture = vertical ? portadaVertical : portadaHorizontal;
  const image = await getImage({ src: picture, widths: [340, 680] });
  return { src: image.src, srcset: image.srcSet.attribute, width: picture.width, height: picture.height };
}

/** Vista de una página «Acerca de Carlos» con el contenido publicado. */
export async function publishedPageView(slug: AboutCarlosSlug): Promise<AboutCarlosPageView> {
  const page = await contentRepository.getAboutCarlosPage(slug);
  return {
    slug,
    texts: Object.fromEntries(await Promise.all(TEXT_KEYS[slug].map(async (key) => [key, await texto(key)]))),
    cards: await fixedCards(slug),
    videos: await Promise.all(page.videos.map(async (v) => ({
      title: v.title, description: v.description, url: v.url, vertical: v.vertical, medium: v.medium ?? null,
      cover: v.cover ? imageView(v.cover) : await defaultCover(v.vertical),
    }))),
    interview: page.interview,
    gallery: page.gallery.map((g) => ({ image: imageView(g.image), alt: g.alt, caption: g.caption })),
  };
}
