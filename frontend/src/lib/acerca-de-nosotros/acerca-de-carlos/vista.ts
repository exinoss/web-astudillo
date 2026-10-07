import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";
import portadaHorizontal from "../../../assets/portada.jpg";
import portadaVertical from "../../../assets/carlos-vertical.png";
import { texto } from "../../comun/contenido";
import type { TextKey } from "../../comun/contenido/textos";
import { contentRepository } from "../../data";
import type { AboutCarlosSlug, Picture } from "../../data/types";
import { cardImageUrl, isUploaded, uploadedSrcset, uploadedUrl } from "../../comun/fotos";
import type { CardView } from "./tarjeta";

export interface ImageView { src: string; srcset?: string; width?: number; height?: number }

export interface AboutCarlosPageView {
  slug: AboutCarlosSlug;
  texts: Record<string, string>;
  cards: CardView[];
  video: { title: string; description: string | null; url: string; vertical: boolean; cover: ImageView } | null;
  portrait: { image: ImageView; alt: string } | null;
  interview: { question: string; answer: string }[];
  gallery: { image: ImageView; alt: string; caption: string }[];
}

const TEXT_KEYS: Record<AboutCarlosSlug, TextKey[]> = {
  "por-que-quiero-ser-alcalde": ["alcalde.antetitulo", "alcalde.titulo", "alcalde.cita", "alcalde.nota"],
  "conoce-mas": ["conoce-mas.antetitulo", "conoce-mas.titulo", "conoce-mas.texto"],
};

/** `widths` solo cuenta para las imágenes locales: las subidas ya vienen en varios anchos. */
async function imageView(picture: Picture, widths: number[]): Promise<ImageView> {
  if (isUploaded(picture)) return {
    src: uploadedUrl(picture, picture.anchos.at(-1)!), srcset: uploadedSrcset(picture), width: picture.ancho, height: picture.alto,
  };
  const image = await getImage({ src: picture, widths });
  return { src: image.src, srcset: image.srcSet.attribute, width: picture.width, height: picture.height };
}

const cardImage = async (picture: Picture) =>
  isUploaded(picture) ? cardImageUrl(picture) : (await getImage({ src: picture, width: 520, format: "webp" })).src;

export async function publishedPageView(slug: AboutCarlosSlug): Promise<AboutCarlosPageView> {
  const page = await contentRepository.getAboutCarlosPage(slug);
  const defaultCover = page.video?.vertical ? portadaVertical : portadaHorizontal;
  return {
    slug,
    texts: Object.fromEntries(await Promise.all(TEXT_KEYS[slug].map(async (key) => [key, await texto(key)]))),
    cards: await Promise.all(page.cards.map(async ({ image, ...card }) => ({ ...card, src: await cardImage(image) }))),
    video: page.video && {
      title: page.video.title, description: page.video.description, url: page.video.url, vertical: page.video.vertical,
      cover: await imageView(page.video.cover ?? defaultCover as ImageMetadata, [340, 680]),
    },
    portrait: page.portrait && { image: await imageView(page.portrait.image, [400, 800]), alt: page.portrait.alt },
    interview: page.interview,
    gallery: await Promise.all(page.gallery.map(async (g) => ({ image: await imageView(g.image, [480, 960, 1600]), alt: g.alt, caption: g.caption }))),
  };
}
