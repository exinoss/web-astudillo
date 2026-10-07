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

// La plantilla de cada foto trae las clases de la vista del móvil; el visor pone las suyas.
const VIEWER_IMAGE = "max-h-[calc(100dvh-230px)] max-w-full rounded-[4px] object-contain transition-opacity duration-200 max-tablet:max-h-[calc(100dvh-250px)] max-tablet:rounded-none";
const VIEWER_CAPTION = "mt-3 max-w-[720px] px-4 text-center text-[1rem] leading-normal text-white/90";

function gallery(root: HTMLElement) {
  const templates = [...root.querySelectorAll<HTMLTemplateElement>("[data-gallery-photo]")];
  const dialog = root.querySelector<HTMLDialogElement>("[data-gallery-dialog]")!;
  const mobile = root.querySelector<HTMLElement>("[data-mobile-stage]")!;
  const stage = root.querySelector<HTMLElement>("[data-dialog-stage]")!;
  const thumbs = [...root.querySelectorAll<HTMLButtonElement>("[data-gallery-thumb]")];
  let selected = 0;
  let opener: HTMLElement | null = null;
  const still = () => document.documentElement.classList.contains("reduce-motion");
  const photo = () => templates[selected].content.cloneNode(true) as DocumentFragment;
  const viewerPhoto = () => {
    const figure = document.createElement("figure");
    figure.className = "m-0 flex flex-col items-center";
    figure.append(photo());
    const image = figure.querySelector("img")!;
    image.className = VIEWER_IMAGE;
    figure.querySelector("figcaption")!.className = VIEWER_CAPTION;
    if (!still()) {
      image.style.opacity = "0";
      requestAnimationFrame(() => requestAnimationFrame(() => { image.style.opacity = "1"; }));
    }
    return figure;
  };
  const render = () => {
    mobile.replaceChildren(...photo().childNodes);
    mobile.querySelector("img")?.classList.replace("object-contain", "object-cover");
    if (dialog.open) stage.replaceChildren(viewerPhoto());
    root.querySelectorAll("[data-counter]").forEach((counter) => { counter.textContent = `${selected + 1} / ${templates.length}`; });
    root.querySelectorAll<HTMLButtonElement>("[data-previous]").forEach((button) => { button.disabled = selected === 0; });
    root.querySelectorAll<HTMLButtonElement>("[data-next]").forEach((button) => { button.disabled = selected === templates.length - 1; });
    thumbs.forEach((thumb, i) => thumb.setAttribute("aria-current", String(i === selected)));
    if (dialog.open) thumbs[selected]?.scrollIntoView({ block: "nearest", inline: "center" });
  };
  const go = (index: number) => { selected = Math.max(0, Math.min(templates.length - 1, index)); render(); };
  const open = (index: number, button: HTMLElement) => {
    selected = index;
    opener = button;
    // El fondo no se desplaza mientras se miran las fotos.
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    render();
  };
  root.querySelector<HTMLElement>("[data-gallery-open]")!.addEventListener("click", (e) => open(selected, e.currentTarget as HTMLElement));
  root.querySelectorAll<HTMLElement>("[data-photo-open]").forEach((button) => button.addEventListener("click", () => open(Number(button.dataset.photoOpen), button)));
  root.querySelectorAll("[data-previous]").forEach((button) => button.addEventListener("click", () => go(selected - 1)));
  root.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => go(selected + 1)));
  thumbs.forEach((thumb, i) => thumb.addEventListener("click", () => go(i)));
  root.querySelector("[data-gallery-close]")!.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if ((e.target as HTMLElement).hasAttribute("data-gallery-backdrop")) dialog.close(); });
  dialog.addEventListener("close", () => { document.documentElement.style.overflow = ""; opener?.focus(); });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(selected - 1);
    if (e.key === "ArrowRight") go(selected + 1);
  });
  for (const area of [mobile, stage]) {
    let start = 0;
    area.addEventListener("touchstart", (e) => { start = e.touches[0].clientX; }, { passive: true });
    area.addEventListener("touchend", (e) => {
      const distance = e.changedTouches[0].clientX - start;
      if (Math.abs(distance) > 45) go(selected + (distance < 0 ? 1 : -1));
    }, { passive: true });
  }
  render();
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
