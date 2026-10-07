import { esc } from "../../comun/html";
import { iconSvg } from "../../comun/iconos";
import { img } from "./html";
import type { AboutCarlosPageView } from "./vista";

export function gallerySection(photos: AboutCarlosPageView["gallery"]) {
  if (!photos.length) return "";
  const control = "grid size-11 shrink-0 place-items-center rounded-[3px] border border-base-300 bg-base-100 text-primary disabled:opacity-40";
  const layout = photos.length >= 3 ? "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] grid-rows-2" : photos.length === 2 ? "grid-cols-2" : "grid-cols-1";
  const nav = `<div class="mt-3 flex items-center justify-between gap-3">
        <button data-previous type="button" class="${control}" aria-label="Foto anterior">${iconSvg("chevronLeft", 19)}</button>
        <span data-counter class="text-[0.8rem]">1 / ${photos.length}</span>
        <button data-next type="button" class="${control}" aria-label="Foto siguiente">${iconSvg("chevronRight", 19)}</button>
      </div>`;
  return `
<section data-gallery aria-labelledby="galeria-titulo" class="mt-9 max-tablet:mt-8">
  <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
    <h2 id="galeria-titulo" class="m-0 text-[2rem]">Momentos en imágenes</h2>
    <button data-gallery-open type="button" class="inline-flex min-h-11 items-center gap-2 text-[0.82rem] font-bold underline underline-offset-4">Ver todas (${photos.length}) ${iconSvg("expand", 17)}</button>
  </div>
  <div class="grid h-[340px] gap-3 max-tablet:hidden ${layout}">
    ${photos.slice(0, 3).map((photo, i) => `<button data-photo-open="${i}" type="button" aria-label="Ampliar: ${esc(photo.caption)}" class="relative min-h-0 overflow-hidden rounded-[3px]${i === 0 && photos.length >= 3 ? " row-span-2" : ""}">
      ${img(photo.image, photo.alt, "h-full w-full object-cover", "500px")}
    </button>`).join("")}
  </div>
  <div class="hidden max-tablet:block">
    <figure data-mobile-stage class="m-0 overflow-hidden rounded-[3px]"></figure>
    ${nav}
  </div>
  <dialog data-gallery-dialog aria-labelledby="galeria-dialogo-titulo" class="fixed inset-0 m-auto max-h-[90dvh] w-[min(950px,calc(100vw-32px))] max-w-none overflow-y-auto rounded-[3px] border-0 bg-base-100 p-5 text-primary backdrop:bg-primary/85 max-tablet:p-3">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 id="galeria-dialogo-titulo" class="m-0 text-[1.8rem]">Momentos en imágenes</h2>
      <button data-gallery-close type="button" class="${control}" aria-label="Cerrar galería">${iconSvg("close", 20)}</button>
    </div>
    <div data-dialog-stage class="min-w-0"></div>
    ${nav}
  </dialog>
  ${photos.map((photo) => `<template data-gallery-photo>
    ${img(photo.image, photo.alt, "mx-auto aspect-[4/3] max-h-[65dvh] w-full object-contain", "(max-width: 760px) calc(100vw - 40px), 900px", "eager")}
    <figcaption class="mt-2 text-[0.8rem] leading-normal">${esc(photo.caption)}</figcaption>
  </template>`).join("")}
</section>`;
}
