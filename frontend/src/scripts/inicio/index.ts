import "./cifras";
import "../comun/carrusel-fotos";
import { montarVisor } from "../../lib/comun/visor-fotos";
import { autoavance, deslizar } from "../../lib/comun/carrusel";

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
// No avanza mientras el puntero está sobre el candidato del banner 1, para no cortar su zoom.
const syncAutoplay = autoavance(() => { if (!document.querySelector(".silueta-portada polygon:hover")) showSlide(index + 1); }, 6000);
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
  });
  profileDots().forEach((dot, i) => {
    dot.classList.toggle("is-active", i === profileIndex);
    dot.setAttribute("aria-current", String(i === profileIndex));
  });
};
const profileCarousel =
  document.querySelector<HTMLElement>(".profile-carousel")!;
profileCarousel.addEventListener("click", (e) => {
  const dot = (e.target as Element).closest<HTMLButtonElement>(".profile-dot");
  if (!dot) return;
  showProfileSlide(profileDots().indexOf(dot));
  syncProfileAutoplay();
});
deslizar(profileCarousel, (cuanto) => {
  showProfileSlide(profileIndex + cuanto);
  syncProfileAutoplay();
});
const syncProfileAutoplay = autoavance(() => showProfileSlide(profileIndex + 1), 5000, () => profileImages().length > 1);
document.addEventListener("carruseles:cambiados", () => {
  index = 0;
  profileIndex = 0;
  syncAutoplay();
  syncProfileAutoplay();
});
