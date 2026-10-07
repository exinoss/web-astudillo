import type { CardColor } from "../../data/types";
import { esc } from "../../comun/html";

// Cambiar estos colores obliga a revisar el contraste del título amarillo (mínimo 3:1 sobre la base).
export const CARD_COLORS: Record<CardColor, { base: string; ink: string }> = {
  rojo: { base: "#d81919", ink: "#6e0400" },
  azul: { base: "#284e9c", ink: "#001c48" },
};

export interface CardView {
  title: string;
  text: string;
  alt: string;
  color: CardColor;
  focus: { x: number; y: number };
  src: string;
  srcset?: string;
}

/**
 * También la usa la vista previa del panel. `id` debe ser único en la página: nombra el filtro SVG.
 * La sombra inferior da a «Leer más», que es texto pequeño, el contraste de 4,5:1 sobre cualquier foto.
 */
export function cardMarkup(card: CardView, number: number, id: string) {
  const { base, ink } = CARD_COLORS[card.color];
  const filter = `${id}-duotono`;
  return `<article data-carlos-card data-card-id="${esc(id)}" style="--mask-color:${base};--ink-color:${ink};--focus:${card.focus.x}% ${card.focus.y}%" class="group/card flex w-[260px] max-w-full min-w-0 shrink-0 snap-start text-primary max-tablet:w-[200px] data-[layout=mobile]:w-[200px]">
  <details data-card-description class="group/description flex w-full overflow-hidden rounded-[16px] [background:var(--mask-color)]">
    <summary data-card-face class="relative isolate flex h-full min-h-[380px] w-full cursor-pointer list-none flex-col px-7 pt-4 pb-3 text-[#ffc20e] [&::-webkit-details-marker]:hidden max-tablet:min-h-[300px] max-tablet:px-[22px] group-data-[layout=mobile]/card:min-h-[300px] group-data-[layout=mobile]/card:px-[22px]">
      <img data-card-photo src="${esc(card.src)}"${card.srcset ? ` srcset="${esc(card.srcset)}" sizes="(max-width: 760px) 200px, 260px"` : ""} alt="${esc(card.alt)}" loading="lazy" decoding="async" class="absolute inset-0 -z-20 h-full w-full object-cover [object-position:var(--focus)]" style="filter:url(#${esc(filter)})" />
      <div aria-hidden="true" class="absolute inset-0 -z-10 [background:linear-gradient(to_top,var(--ink-color)_0%,var(--ink-color)_14%,transparent_46%)] group-open/description:[background:var(--ink-color)] group-open/description:opacity-[0.93]"></div>
      <svg aria-hidden="true" class="pointer-events-none absolute h-0 w-0">
        <filter id="${esc(filter)}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
          <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="gray" />
          <feComponentTransfer in="gray" result="inverse"><feFuncR type="table" tableValues="1 0" /><feFuncG type="table" tableValues="1 0" /><feFuncB type="table" tableValues="1 0" /></feComponentTransfer>
          <feFlood flood-color="var(--mask-color)" result="base" />
          <feFlood flood-color="var(--ink-color)" result="ink" />
          <feComposite in="base" in2="gray" operator="arithmetic" k1="1" result="lit" />
          <feComposite in="ink" in2="inverse" operator="arithmetic" k1="1" result="shade" />
          <feComposite in="lit" in2="shade" operator="arithmetic" k2="1" k3="1" />
        </filter>
      </svg>
      <span data-card-number aria-hidden="true" class="block self-end font-sans text-[5rem] leading-none font-bold max-tablet:text-[3.75rem] group-data-[layout=mobile]/card:text-[3.75rem] group-open/description:text-[2.5rem]">${number}</span>
      <div class="mt-auto flex flex-col items-start gap-2">
        <h3 data-card-title class="m-0 font-sans text-[2rem] leading-[1.08] font-normal [overflow-wrap:anywhere] max-tablet:text-[1.5rem] group-data-[layout=mobile]/card:text-[1.5rem] group-open/description:text-[1.3rem] max-tablet:group-open/description:text-[1.15rem]">${esc(card.title)}</h3>
        <p aria-hidden="true" class="m-0 hidden text-[0.9rem] leading-[1.55] text-white [overflow-wrap:anywhere] group-open/description:block max-tablet:text-[0.82rem] group-data-[layout=mobile]/card:text-[0.82rem]">${esc(card.text)}</p>
        <span class="-ml-1 inline-flex min-h-11 items-center gap-2 px-1 text-[0.85rem] font-bold">
          <span class="underline decoration-2 underline-offset-4"><span class="group-open/description:hidden">Leer más</span><span class="hidden group-open/description:inline">Leer menos</span></span>
          <span aria-hidden="true" class="grid size-6 place-items-center rounded-full border-2 border-current text-[0.95rem] leading-none"><span class="group-open/description:hidden">+</span><span class="hidden group-open/description:inline">−</span></span>
        </span>
      </div>
    </summary>
    <p class="sr-only">${esc(card.text)}</p>
  </details>
</article>`;
}
