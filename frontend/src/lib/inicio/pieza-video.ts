import { esc } from "../comun/html";
import type { ImageView } from "../comun/fotos";
import { videoSource } from "../acerca-de-nosotros/acerca-de-carlos/reproductor";
import { portadaReproducible } from "../acerca-de-nosotros/acerca-de-carlos/video";

export interface PiezaVideo { title: string; url: string; vertical: boolean; cover: ImageView }

/** Diapositiva `i` del carrusel de piezas con un video: su portada completa, en el formato del video, sobre el fondo del marco. */
export function piezaVideo(v: PiezaVideo, i: number) {
  const source = videoSource(v.url);
  if (!source) return "";
  // pb-14 deja libres los puntos del carrusel y su área táctil.
  return `<div data-profile-image="${i}" data-video-preview data-embed="${esc(source.embed)}" data-provider="${source.provider}" class="absolute inset-0 grid place-items-center p-4 pb-14"${i ? " hidden" : ""}>
  <div data-video-stage class="relative overflow-hidden rounded-[12px] bg-primary ${v.vertical ? "h-full aspect-[9/16]" : "w-full aspect-video"}">${portadaReproducible(source, v.title, esc(v.title), v.cover, v.vertical ? "(max-width: 760px) 63vw, 28vw" : "(max-width: 760px) 90vw, 40vw")}
  </div>
</div>`;
}
