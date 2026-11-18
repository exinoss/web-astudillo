import "./cifras";
import "../comun/carrusel-fotos";
import { montarVisor } from "../../lib/comun/visor-fotos";
import { autoavance, deslizar } from "../../lib/comun/carrusel";
import { activarVideo, detenerVideo } from "../../lib/acerca-de-nosotros/acerca-de-carlos/reproductor";

const equipo = document.querySelector<HTMLElement>('[data-carrusel-editable="equipo"] [data-carrusel]');
if (equipo?.querySelector("[data-visor]")) montarVisor(equipo);

// Las listas se vuelven a leer y los clics se delegan: el modo edición cambia diapositivas y puntos (carruseles:cambiados).
const slides = () => [...document.querySelectorAll<HTMLElement>("[data-slide]")];
const slideDots = () => [...document.querySelectorAll<HTMLButtonElement>(".slide-dot")];
let index = 0;
/** Selecciona una diapositiva del carrusel principal y actualiza sus indicadores. */
const showSlide = (next: number) => {
  const all = slides();
  index = (next + all.length) % all.length;
  all.forEach((slide, i) => (slide.hidden = i !== index));
  slideDots().forEach((dot, i) => {
    dot.classList.toggle("is-active", i === index);
    dot.setAttribute("aria-current", String(i === index));
  });
};
// No avanza con el puntero sobre el candidato del banner 1 (cortaría su zoom) ni mientras se edita un texto o hay un diálogo abierto.
const quieto = () => document.querySelector(".silueta-portada polygon:hover, .hero-slides [contenteditable], dialog[open]");
const syncAutoplay = autoavance(() => { if (!quieto()) showSlide(index + 1); }, 6000);
const carousel = document.querySelector<HTMLElement>(".hero-slides")!;
// El fondo sin el candidato solo sirve para el zoom con ratón: se descarga al entrar el puntero, no en celular.
carousel.addEventListener("pointerenter", (e) => {
  const fondo = carousel.querySelector<SVGImageElement>(".silueta-portada [data-href]");
  if (e.pointerType !== "mouse" || !fondo) return;
  fondo.setAttribute("href", fondo.dataset.href!);
  fondo.removeAttribute("data-href");
});
carousel.addEventListener("click", (e) => {
  const target = e.target as Element;
  const dot = target.closest<HTMLButtonElement>(".slide-dot");
  const step = target.closest(".slide-prev") ? -1 : target.closest(".slide-next") ? 1 : 0;
  if (!dot && !step) return;
  showSlide(dot ? slideDots().indexOf(dot) : index + step);
  syncAutoplay();
});
deslizar(carousel, (cuanto) => {
  showSlide(index + cuanto);
  syncAutoplay();
});
const profileImages = () => [...document.querySelectorAll<HTMLElement>("[data-profile-image]")];
const profileDots = () => [...document.querySelectorAll<HTMLButtonElement>(".profile-dot")];
let profileIndex = 0;
/** Selecciona una imagen del carrusel del perfil y actualiza sus indicadores. */
const showProfileSlide = (next: number) => {
  const all = profileImages();
  profileIndex = (next + all.length) % all.length;
  all.forEach((img, i) => {
    img.hidden = i !== profileIndex;
    img.classList.toggle("is-active", i === profileIndex);
    if (i !== profileIndex && img.matches("[data-video-preview]")) detenerVideo(img);
  });
  profileDots().forEach((dot, i) => {
    dot.classList.toggle("is-active", i === profileIndex);
    dot.setAttribute("aria-current", String(i === profileIndex));
  });
  profileCarousel.querySelector<HTMLElement>(".profile-glass-curtain")!.hidden = all[profileIndex].matches("[data-video-preview]");
};
const profileCarousel =
  document.querySelector<HTMLElement>(".profile-carousel")!;
// El modo edición vuelve a pintar las diapositivas: cada video nuevo se activa una sola vez.
const videosActivos = new WeakSet<HTMLElement>();
/** Activa el botón de reproducir de los videos del carrusel que aún no lo tienen. */
const activarVideos = () => profileCarousel.querySelectorAll<HTMLElement>("[data-video-preview]").forEach((v) => {
  if (!videosActivos.has(v)) { videosActivos.add(v); activarVideo(v); }
});
/** Indica si un video del carrusel se está reproduciendo. */
const reproduciendo = () => profileCarousel.querySelector("[data-video-stage] :is(iframe, video)") !== null;
profileCarousel.addEventListener("click", (e) => {
  const target = e.target as Element;
  if (target.closest("[data-video-play], [data-video-retry]")) return syncProfileAutoplay();
  const dot = target.closest<HTMLButtonElement>(".profile-dot");
  if (!dot) return;
  showProfileSlide(profileDots().indexOf(dot));
  syncProfileAutoplay();
});
deslizar(profileCarousel, (cuanto) => {
  showProfileSlide(profileIndex + cuanto);
  syncProfileAutoplay();
});
const syncProfileAutoplay = autoavance(() => showProfileSlide(profileIndex + 1), 5000, () => profileImages().length > 1 && !reproduciendo());
activarVideos();
document.addEventListener("carruseles:cambiados", () => {
  index = 0;
  activarVideos();
  showProfileSlide(0);
  syncAutoplay();
  syncProfileAutoplay();
});
