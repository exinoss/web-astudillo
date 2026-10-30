import { deslizar, montarVisor } from "../../comun/visor-fotos";
import { mountPlayer, type VideoSource } from "./reproductor";

function cardStrip(root: HTMLElement) {
  const strip = root.querySelector<HTMLElement>("[data-card-scroll]")!;
  const navigation = root.querySelector<HTMLElement>("[data-card-navigation]")!;
  const previous = root.querySelector<HTMLButtonElement>("[data-card-previous]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-card-next]")!;
  const update = () => {
    const maximum = strip.scrollWidth - strip.clientWidth;
    navigation.hidden = maximum < 2;
    previous.disabled = strip.scrollLeft < 2;
    next.disabled = strip.scrollLeft >= maximum - 2;
  };
  const move = (direction: number) => strip.scrollBy({
    left: direction * (strip.querySelector<HTMLElement>("article")!.offsetWidth + 16),
    behavior: document.documentElement.classList.contains("reduce-motion") ? "instant" : "smooth",
  });
  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  strip.addEventListener("scroll", update, { passive: true });
  strip.addEventListener("keydown", (event) => {
    if (event.target !== strip || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });
  new ResizeObserver(update).observe(strip);
  update();
}

function gallery(root: HTMLElement) {
  const mobile = root.querySelector<HTMLElement>("[data-mobile-stage]")!;
  const total = root.querySelectorAll("[data-visor-foto]").length;
  const visor = montarVisor(root, (actual, foto) => {
    mobile.replaceChildren(...foto.childNodes);
    mobile.querySelector("img")?.classList.replace("object-contain", "object-cover");
    root.querySelectorAll("[data-counter]").forEach((counter) => { counter.textContent = `${actual + 1} / ${total}`; });
    root.querySelectorAll<HTMLButtonElement>("[data-previous]").forEach((button) => { button.disabled = actual === 0; });
    root.querySelectorAll<HTMLButtonElement>("[data-next]").forEach((button) => { button.disabled = actual === total - 1; });
  });
  root.querySelector<HTMLElement>("[data-gallery-open]")!.addEventListener("click", (e) => visor.abrir(visor.actual, e.currentTarget as HTMLElement));
  root.querySelectorAll("[data-previous]").forEach((button) => button.addEventListener("click", () => visor.ir(visor.actual - 1)));
  root.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => visor.ir(visor.actual + 1)));
  deslizar(mobile, (paso) => visor.ir(visor.actual + paso));
}

function video(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>("[data-video-stage]")!;
  const play = root.querySelector<HTMLButtonElement>("[data-video-play]")!;
  const error = root.querySelector<HTMLElement>("[data-video-error]")!;
  const source = { provider: root.dataset.provider, embed: root.dataset.embed } as VideoSource;
  const title = play.getAttribute("aria-label")!;
  const start = () => {
    error.hidden = true;
    mountPlayer(stage, source, title).addEventListener("error", () => { error.hidden = false; });
    play.hidden = true;
  };
  play.addEventListener("click", start);
  root.querySelector("[data-video-retry]")!.addEventListener("click", start);
}

export function initAboutCarlosPage(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[data-card-strip]").forEach(cardStrip);
  root.querySelectorAll<HTMLElement>("[data-gallery]").forEach(gallery);
  root.querySelectorAll<HTMLElement>("[data-video-preview]").forEach(video);
}
