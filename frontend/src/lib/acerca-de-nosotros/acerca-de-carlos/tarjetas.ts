import { iconSvg } from "../../comun/iconos";
import { cardMarkup, type CardView } from "./tarjeta";

export function cardsSection(title: string, list: CardView[]) {
  if (!list.length) return "";
  return `
<section data-card-strip aria-labelledby="tarjetas-titulo" class="mt-9 max-tablet:mt-8">
  <h2 id="tarjetas-titulo" class="mb-5 text-[2rem]">${title}</h2>
  <div data-card-scroll tabindex="0" role="region" aria-label="${title}" class="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-1 [scrollbar-color:#06317666_transparent] [scrollbar-width:thin]">
    ${list.map((card, i) => cardMarkup(card, i + 1, `tarjeta-${i + 1}`)).join("")}
  </div>
  <div data-card-navigation hidden class="mt-2 flex items-center justify-end gap-2">
    <button data-card-previous type="button" aria-label="Ver tarjetas anteriores" class="grid size-11 place-items-center rounded-full bg-primary text-white disabled:opacity-40">${iconSvg("chevronLeft", 17)}</button>
    <button data-card-next type="button" aria-label="Ver tarjetas siguientes" class="grid size-11 place-items-center rounded-full bg-primary text-white disabled:opacity-40">${iconSvg("chevronRight", 17)}</button>
  </div>
</section>`;
}
