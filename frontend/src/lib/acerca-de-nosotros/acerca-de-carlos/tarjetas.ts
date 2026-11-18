import { esc } from "../../comun/html";
import { iconSvg } from "../../comun/iconos";
import type { ImageView } from "../../comun/fotos";
import { editable } from "./html";

export type CardView = ImageView & { alt: string };

/** Franja de tarjetas fijas con su título editable, flechas y desplazamiento con teclado. */
export function cardsSection(titleKey: string, texts: Record<string, string>, list: CardView[]) {
  return `
<section data-card-strip aria-labelledby="tarjetas-titulo" class="mt-9 max-tablet:mt-8">
  <h2 id="tarjetas-titulo" class="mb-5 text-[2rem]">${editable("span", titleKey, texts, "")}</h2>
  <div data-card-scroll tabindex="0" role="region" aria-label="${esc(texts[titleKey] ?? "")}" class="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-1 [scrollbar-color:#06317666_transparent] [scrollbar-width:thin]">
    ${list.map((card) => `<article class="flex w-[260px] max-w-full min-w-0 shrink-0 snap-start max-tablet:w-[200px]">
      <img src="${esc(card.src)}"${card.srcset ? ` srcset="${esc(card.srcset)}" sizes="(max-width: 760px) 200px, 260px"` : ""} width="${card.width}" height="${card.height}" alt="${esc(card.alt)}" loading="lazy" decoding="async" class="h-auto w-full rounded-[16px]" />
    </article>`).join("")}
  </div>
  <div data-card-navigation hidden class="mt-2 flex items-center justify-end gap-2">
    <button data-card-previous type="button" aria-label="Ver tarjetas anteriores" class="boton-redondo bg-primary text-white disabled:opacity-40">${iconSvg("chevronLeft", 17)}</button>
    <button data-card-next type="button" aria-label="Ver tarjetas siguientes" class="boton-redondo bg-primary text-white disabled:opacity-40">${iconSvg("chevronRight", 17)}</button>
  </div>
</section>`;
}
