const slides = [...document.querySelectorAll<HTMLElement>("[data-slide]")];
let index = 0;
const slideDots = [
  ...document.querySelectorAll<HTMLButtonElement>(".slide-dot"),
];
/** Selecciona una diapositiva del carrusel principal y actualiza sus indicadores. */
const showSlide = (next: number) => {
  index = (next + slides.length) % slides.length;
  slides.forEach((slide, i) => (slide.hidden = i !== index));
  slideDots.forEach((dot, i) => {
    dot.classList.toggle("is-active", i === index);
    dot.setAttribute("aria-current", String(i === index));
  });
};
let timer: ReturnType<typeof setInterval> | undefined;
/** Pausa o inicia el carrusel según visibilidad y modo reduce-motion. */
function syncAutoplay() {
  clearInterval(timer);
  const motionOff =
    document.documentElement.classList.contains("reduce-motion");
  if (!motionOff && !document.hidden)
    timer = setInterval(() => showSlide(index + 1), 6000);
}
document.addEventListener("visibilitychange", syncAutoplay);
new MutationObserver(syncAutoplay).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class"],
});
syncAutoplay();
slideDots.forEach((dot, i) =>
  dot.addEventListener("click", () => {
    showSlide(i);
    syncAutoplay();
  }),
);
const carousel = document.querySelector<HTMLElement>(".hero-slides")!;
let startX = 0;
let startY = 0;
carousel.addEventListener(
  "touchstart",
  (e) => {
    startX = e.changedTouches[0].clientX;
    startY = e.changedTouches[0].clientY;
  },
  { passive: true },
);
carousel.addEventListener(
  "touchend",
  (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      showSlide(index + (dx < 0 ? 1 : -1));
      syncAutoplay();
    }
  },
  { passive: true },
);
const profileImages = [
  ...document.querySelectorAll<HTMLElement>("[data-profile-image]"),
];
const profileDots = [
  ...document.querySelectorAll<HTMLButtonElement>(".profile-dot"),
];
let profileIndex = 0;
/** Selecciona una imagen del carrusel del perfil y actualiza sus indicadores. */
const showProfileSlide = (next: number) => {
  profileIndex = (next + profileImages.length) % profileImages.length;
  profileImages.forEach((img, i) => {
    img.hidden = i !== profileIndex;
    img.classList.toggle("is-active", i === profileIndex);
  });
  profileDots.forEach((dot, i) => {
    dot.classList.toggle("is-active", i === profileIndex);
    dot.setAttribute("aria-current", String(i === profileIndex));
  });
};
profileDots.forEach((dot, i) =>
  dot.addEventListener("click", () => {
    showProfileSlide(i);
    syncProfileAutoplay();
  }),
);
const profileCarousel =
  document.querySelector<HTMLElement>(".profile-carousel")!;
let profileStartX = 0;
let profileStartY = 0;
profileCarousel.addEventListener(
  "touchstart",
  (e) => {
    profileStartX = e.changedTouches[0].clientX;
    profileStartY = e.changedTouches[0].clientY;
  },
  { passive: true },
);
profileCarousel.addEventListener(
  "touchend",
  (e) => {
    const dx = e.changedTouches[0].clientX - profileStartX;
    const dy = e.changedTouches[0].clientY - profileStartY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      showProfileSlide(profileIndex + (dx < 0 ? 1 : -1));
      syncProfileAutoplay();
    }
  },
  { passive: true },
);
let profileTimer: ReturnType<typeof setInterval> | undefined;
/** Sincroniza la rotación del carrusel del perfil con accesibilidad y pestaña. */
function syncProfileAutoplay() {
  clearInterval(profileTimer);
  const motionOff =
    document.documentElement.classList.contains("reduce-motion");
  if (!motionOff && !document.hidden)
    profileTimer = setInterval(() => showProfileSlide(profileIndex + 1), 5000);
}
document.addEventListener("visibilitychange", syncProfileAutoplay);
new MutationObserver(syncProfileAutoplay).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class"],
});
syncProfileAutoplay();
