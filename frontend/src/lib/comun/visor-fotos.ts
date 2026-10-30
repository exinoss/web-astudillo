import type { ImageView } from "./fotos";
import { esc, img } from "./html";
import { iconSvg } from "./iconos";

export interface FotoDelVisor { image: ImageView; alt: string; caption: string }

const REDONDO = "grid size-12 shrink-0 place-items-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/25 disabled:opacity-30 disabled:hover:bg-white/12 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
// La plantilla de cada foto trae las clases de la vista del móvil de la galería; el visor pone las suyas.
const IMAGEN_AMPLIADA = "max-h-[calc(100dvh-230px)] max-w-full rounded-[4px] object-contain transition-opacity duration-200 max-tablet:max-h-[calc(100dvh-250px)] max-tablet:rounded-none";
const PIE_AMPLIADO = "mt-3 max-w-[720px] px-4 text-center text-[1rem] leading-normal text-white/90";

/** Diálogo a pantalla completa y una plantilla por foto. Lo abren los botones `data-visor-abrir` del mismo contenedor. */
export function visorFotos(id: string, titulo: string, fotos: FotoDelVisor[]) {
  const varias = fotos.length > 1;
  const paso = (cuanto: -1 | 1, clase = "") => `<button data-visor-paso="${cuanto}" type="button" class="${REDONDO} ${clase}" aria-label="${cuanto < 0 ? "Foto anterior" : "Foto siguiente"}">${iconSvg(cuanto < 0 ? "chevronLeft" : "chevronRight", 24)}</button>`;
  return `
  <dialog data-visor aria-labelledby="${id}-titulo" class="m-0 h-dvh max-h-none w-screen max-w-none overscroll-contain bg-[#021530]/97 p-0 text-white backdrop:bg-transparent">
    <div class="flex h-full flex-col">
      <div class="flex items-center justify-between gap-3 px-5 pt-4 pb-2 max-tablet:px-3">
        <h2 id="${id}-titulo" class="sr-only">${esc(titulo)}</h2>
        <span data-visor-contador class="text-[0.9rem] font-bold tabular-nums">1 / ${fotos.length}</span>
        <button data-visor-cerrar type="button" class="${REDONDO}" aria-label="Cerrar galería">${iconSvg("close", 22)}</button>
      </div>
      <div data-visor-fondo class="flex min-h-0 flex-1 items-center justify-center gap-4 px-6 max-tablet:px-0">
        ${varias ? paso(-1, "max-tablet:hidden") : ""}
        <div data-visor-escena data-visor-fondo class="flex h-full min-w-0 flex-1 flex-col items-center justify-center"></div>
        ${varias ? paso(1, "max-tablet:hidden") : ""}
      </div>
      ${varias ? `<div class="hidden items-center justify-center gap-6 pt-2 max-tablet:flex">${paso(-1)}${paso(1)}</div>
      <div role="group" aria-label="Elegir foto" class="flex justify-center gap-2 overflow-x-auto px-4 pt-3 pb-5 max-tablet:justify-start">
        ${fotos.map((foto, i) => `<button data-visor-miniatura type="button" aria-label="Foto ${i + 1}: ${esc(foto.caption)}" class="relative size-16 shrink-0 overflow-hidden rounded-[6px] opacity-60 outline-offset-2 transition-opacity hover:opacity-100 aria-current:opacity-100 aria-current:outline-3 aria-current:outline-accent focus-visible:opacity-100 focus-visible:outline-3 focus-visible:outline-white max-tablet:size-14">
          ${img(foto.image, "", "h-full w-full object-cover", "64px")}
        </button>`).join("")}
      </div>` : `<div class="pb-5"></div>`}
    </div>
  </dialog>
  ${fotos.map((foto) => `<template data-visor-foto>
    ${img(foto.image, foto.alt, "mx-auto aspect-[4/3] max-h-[65dvh] w-full object-contain", "(max-width: 760px) calc(100vw - 40px), 900px", "eager")}
    <figcaption class="mt-2 text-[0.8rem] leading-normal">${esc(foto.caption)}</figcaption>
  </template>`).join("")}`;
}

/**
 * Hace funcionar el visor de `root`. `alCambiar` recibe la foto elegida cada vez que cambia, también al montarse:
 * la galería la usa para su vista del móvil.
 */
export function montarVisor(root: HTMLElement, alCambiar?: (actual: number, foto: DocumentFragment) => void) {
  const plantillas = [...root.querySelectorAll<HTMLTemplateElement>("[data-visor-foto]")];
  const dialogo = root.querySelector<HTMLDialogElement>("[data-visor]")!;
  const escena = dialogo.querySelector<HTMLElement>("[data-visor-escena]")!;
  const miniaturas = [...dialogo.querySelectorAll<HTMLButtonElement>("[data-visor-miniatura]")];
  let actual = 0;
  let origen: HTMLElement | null = null;
  const quieto = () => document.documentElement.classList.contains("reduce-motion");
  const foto = () => plantillas[actual].content.cloneNode(true) as DocumentFragment;
  const ampliada = () => {
    const figura = document.createElement("figure");
    figura.className = "m-0 flex flex-col items-center";
    figura.append(foto());
    const imagen = figura.querySelector("img")!;
    imagen.className = IMAGEN_AMPLIADA;
    figura.querySelector("figcaption")!.className = PIE_AMPLIADO;
    if (!quieto()) {
      imagen.style.opacity = "0";
      requestAnimationFrame(() => requestAnimationFrame(() => { imagen.style.opacity = "1"; }));
    }
    return figura;
  };
  const pintar = () => {
    if (dialogo.open) escena.replaceChildren(ampliada());
    dialogo.querySelector("[data-visor-contador]")!.textContent = `${actual + 1} / ${plantillas.length}`;
    dialogo.querySelectorAll<HTMLButtonElement>("[data-visor-paso]").forEach((boton) => {
      boton.disabled = Number(boton.dataset.visorPaso) < 0 ? actual === 0 : actual === plantillas.length - 1;
    });
    miniaturas.forEach((miniatura, i) => miniatura.setAttribute("aria-current", String(i === actual)));
    if (dialogo.open) miniaturas[actual]?.scrollIntoView({ block: "nearest", inline: "center" });
    alCambiar?.(actual, foto());
  };
  const ir = (indice: number) => { actual = Math.max(0, Math.min(plantillas.length - 1, indice)); pintar(); };
  const abrir = (indice: number, boton: HTMLElement) => {
    actual = indice;
    origen = boton;
    // El fondo no se desplaza mientras se miran las fotos.
    document.documentElement.style.overflow = "hidden";
    dialogo.showModal();
    pintar();
  };
  root.querySelectorAll<HTMLElement>("[data-visor-abrir]").forEach((boton) => boton.addEventListener("click", () => abrir(Number(boton.dataset.visorAbrir), boton)));
  dialogo.querySelectorAll<HTMLButtonElement>("[data-visor-paso]").forEach((boton) => boton.addEventListener("click", () => ir(actual + Number(boton.dataset.visorPaso))));
  miniaturas.forEach((miniatura, i) => miniatura.addEventListener("click", () => ir(i)));
  dialogo.querySelector("[data-visor-cerrar]")!.addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("click", (e) => { if ((e.target as HTMLElement).hasAttribute("data-visor-fondo")) dialogo.close(); });
  dialogo.addEventListener("close", () => { document.documentElement.style.overflow = ""; origen?.focus(); });
  dialogo.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") ir(actual - 1);
    if (e.key === "ArrowRight") ir(actual + 1);
  });
  deslizar(escena, (cuanto) => ir(actual + cuanto));
  pintar();
  return { abrir, ir, get actual() { return actual; } };
}

/** Deslizar en horizontal llama a `paso` con -1 o 1. */
export function deslizar(zona: HTMLElement, paso: (cuanto: -1 | 1) => void) {
  let inicio = 0;
  zona.addEventListener("touchstart", (e) => { inicio = e.touches[0].clientX; }, { passive: true });
  zona.addEventListener("touchend", (e) => {
    const distancia = e.changedTouches[0].clientX - inicio;
    if (Math.abs(distancia) > 45) paso(distancia < 0 ? 1 : -1);
  }, { passive: true });
}
