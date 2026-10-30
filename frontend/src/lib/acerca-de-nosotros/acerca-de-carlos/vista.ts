import { getImage } from "astro:assets";
import portadaHorizontal from "../../../assets/portada.jpg";
import portadaVertical from "../../../assets/carlos-vertical.png";
import { texto } from "../../comun/contenido";
import type { TextKey } from "../../comun/contenido/textos";
import { contentRepository } from "../../data";
import type { AboutCarlosSlug, UploadedPicture } from "../../data/types";
import { cardImageUrl, uploadedSrcset, uploadedUrl } from "../../comun/fotos";
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

const imageView = (picture: UploadedPicture): ImageView => ({
  src: uploadedUrl(picture, picture.anchos.at(-1)!), srcset: uploadedSrcset(picture), width: picture.ancho, height: picture.alto,
});

async function defaultCover(vertical: boolean): Promise<ImageView> {
  const picture = vertical ? portadaVertical : portadaHorizontal;
  const image = await getImage({ src: picture, widths: [340, 680] });
  return { src: image.src, srcset: image.srcSet.attribute, width: picture.width, height: picture.height };
}

export async function publishedPageView(slug: AboutCarlosSlug): Promise<AboutCarlosPageView> {
  const page = await contentRepository.getAboutCarlosPage(slug);
  return {
    slug,
    texts: Object.fromEntries(await Promise.all(TEXT_KEYS[slug].map(async (key) => [key, await texto(key)]))),
    cards: page.cards.map(({ image, ...card }) => ({ ...card, src: cardImageUrl(image) })),
    video: page.video && {
      title: page.video.title, description: page.video.description, url: page.video.url, vertical: page.video.vertical,
      cover: page.video.cover ? imageView(page.video.cover) : await defaultCover(page.video.vertical),
    },
    portrait: page.portrait && { image: imageView(page.portrait.image), alt: page.portrait.alt },
    interview: page.interview,
    gallery: page.gallery.map((g) => ({ image: imageView(g.image), alt: g.alt, caption: g.caption })),
  };
}
