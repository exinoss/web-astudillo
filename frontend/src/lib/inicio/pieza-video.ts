import { esc, img } from "../comun/html";
import type { ImageView } from "../comun/fotos";
import { videoSource } from "../acerca-de-nosotros/acerca-de-carlos/reproductor";
import { verVideo, videoError } from "../acerca-de-nosotros/acerca-de-carlos/video";

export interface PiezaVideo { title: string; url: string; vertical: boolean; cover: ImageView }

/** Diapositiva `i` del carrusel de piezas con un video: su portada completa, en el formato del video, sobre el fondo del marco. */
export function piezaVideo(v: PiezaVideo, i: number) {
  const source = videoSource(v.url);
  if (!source) return "";
  // pb-14 deja libres los puntos del carrusel y su área táctil.
  return `<div data-profile-image="${i}" data-video-preview data-embed="${esc(source.embed)}" data-provider="${source.provider}" class="absolute inset-0 grid place-items-center p-4 pb-14"${i ? " hidden" : ""}>
  <div data-video-stage class="relative overflow-hidden rounded-[12px] bg-primary ${v.vertical ? "h-full aspect-[9/16]" : "w-full aspect-video"}">
    ${img(v.cover, "", "absolute inset-0 h-full w-full object-cover object-[50%_25%]", v.vertical ? "(max-width: 760px) 63vw, 28vw" : "(max-width: 760px) 90vw, 40vw")}
    <div aria-hidden="true" class="absolute inset-0 [background:linear-gradient(to_top,#063176e6_0%,transparent_45%)]"></div>
    <button data-video-play type="button" aria-label="Reproducir el video: ${esc(v.title)}" class="group absolute inset-0 flex items-end p-4 text-left text-white">${verVideo(esc(v.title))}</button>
    ${videoError(source)}
  </div>
</div>`;
}
