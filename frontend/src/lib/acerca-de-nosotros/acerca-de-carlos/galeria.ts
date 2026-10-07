import { esc } from "../../comun/html";
import { iconSvg } from "../../comun/iconos";
import { img } from "./html";
import type { AboutCarlosPageView } from "./vista";

export function gallerySection(photos: AboutCarlosPageView["gallery"]) {
  if (!photos.length) return "";
  const control = "grid size-11 shrink-0 place-items-center rounded-[3px] border border-base-300 bg-base-100 text-primary disabled:opacity-40";
  const layout = photos.length >= 3 ? "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] grid-rows-2" : photos.length === 2 ? "grid-cols-2" : "grid-cols-1";
  const round = "grid size-12 shrink-0 place-items-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/25 disabled:opacity-30 disabled:hover:bg-white/12 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
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
  <dialog data-gallery-dialog aria-labelledby="galeria-dialogo-titulo" class="m-0 h-dvh max-h-none w-screen max-w-none overscroll-contain bg-[#021530]/97 p-0 text-white backdrop:bg-transparent">
    <div class="flex h-full flex-col">
      <div class="flex items-center justify-between gap-3 px-5 pt-4 pb-2 max-tablet:px-3">
        <h2 id="galeria-dialogo-titulo" class="sr-only">Momentos en imágenes</h2>
        <span data-counter class="text-[0.9rem] font-bold tabular-nums">1 / ${photos.length}</span>
        <button data-gallery-close type="button" class="${round}" aria-label="Cerrar galería">${iconSvg("close", 22)}</button>
      </div>
      <div data-gallery-backdrop class="flex min-h-0 flex-1 items-center justify-center gap-4 px-6 max-tablet:px-0">
        <button data-previous type="button" class="${round} max-tablet:hidden" aria-label="Foto anterior">${iconSvg("chevronLeft", 24)}</button>
        <div data-dialog-stage data-gallery-backdrop class="flex h-full min-w-0 flex-1 flex-col items-center justify-center"></div>
        <button data-next type="button" class="${round} max-tablet:hidden" aria-label="Foto siguiente">${iconSvg("chevronRight", 24)}</button>
      </div>
      <div class="hidden items-center justify-center gap-6 pt-2 max-tablet:flex">
        <button data-previous type="button" class="${round}" aria-label="Foto anterior">${iconSvg("chevronLeft", 24)}</button>
        <button data-next type="button" class="${round}" aria-label="Foto siguiente">${iconSvg("chevronRight", 24)}</button>
      </div>
      <div role="group" aria-label="Elegir foto" class="flex justify-center gap-2 overflow-x-auto px-4 pt-3 pb-5 max-tablet:justify-start">
        ${photos.map((photo, i) => `<button data-gallery-thumb="${i}" type="button" aria-label="Foto ${i + 1}: ${esc(photo.caption)}" class="relative size-16 shrink-0 overflow-hidden rounded-[6px] opacity-60 outline-offset-2 transition-opacity hover:opacity-100 aria-current:opacity-100 aria-current:outline-3 aria-current:outline-accent focus-visible:opacity-100 focus-visible:outline-3 focus-visible:outline-white max-tablet:size-14">
          ${img(photo.image, "", "h-full w-full object-cover", "64px")}
        </button>`).join("")}
      </div>
    </div>
  </dialog>
  ${photos.map((photo) => `<template data-gallery-photo>
    ${img(photo.image, photo.alt, "mx-auto aspect-[4/3] max-h-[65dvh] w-full object-contain", "(max-width: 760px) calc(100vw - 40px), 900px", "eager")}
    <figcaption class="mt-2 text-[0.8rem] leading-normal">${esc(photo.caption)}</figcaption>
  </template>`).join("")}
</section>`;
}
