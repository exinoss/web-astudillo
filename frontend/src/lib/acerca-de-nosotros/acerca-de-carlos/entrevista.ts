import { PREGUNTAS_ARRIBA } from "../../../../../backend/src/contracts/acerca-de-carlos";
import { esc, escLines, parrafos } from "../../comun/html";
import type { AboutCarlosPageView } from "./vista";

type Preguntas = AboutCarlosPageView["interview"];

/** Tarjetas numeradas que se despliegan; `desde` sigue la cuenta de un bloque anterior. */
export function preguntasTarjetas(items: Preguntas, desde = 0, dosColumnas = false) {
  const paragraphs = (answer: string) => parrafos(answer)
    .map((p) => `<p class="m-0 mb-3 last:mb-0">${escLines(p)}</p>`).join("");
  // items-start: al abrir una tarjeta, la de al lado no se estira.
  return `<div class="grid items-start gap-[18px]${dosColumnas ? " grid-cols-2 max-laptop:grid-cols-[1fr]" : ""}">
    ${items.map((item, i) => `<details class="group rounded-[10px] border border-base-300 bg-base-100 [box-shadow:0_6px_0_#06317614]">
      <summary class="flex min-h-14 cursor-pointer list-none items-start justify-between gap-4 p-5 text-[0.95rem] font-bold max-tablet:p-4 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" class="shrink-0 font-display text-[1.8rem] leading-none font-semibold text-neutral">${String(desde + i + 1).padStart(2, "0")}</span>
        <span class="flex-1">${esc(item.question)}</span>
        <span aria-hidden="true" class="grid size-8 shrink-0 place-items-center rounded-full bg-accent"><span class="group-open:hidden">+</span><span class="hidden group-open:block">−</span></span>
      </summary>
      <div class="px-5 pb-5 text-[0.95rem] leading-[1.7] max-tablet:px-4">${paragraphs(item.answer)}</div>
    </details>`).join("")}
  </div>`;
}

/** Las primeras preguntas, bajo la cabecera de «Conoce más». */
export function interviewSection(items: Preguntas) {
  if (!items.length) return "";
  return `
<section aria-labelledby="entrevista-titulo" class="mt-9 max-tablet:mt-8">
  <h2 id="entrevista-titulo" class="mb-4 text-[2rem]">Una conversación con Carlos</h2>
  ${preguntasTarjetas(items.slice(0, PREGUNTAS_ARRIBA))}
</section>`;
}

/** El resto de las preguntas, al final de «Conoce más». */
export function moreQuestionsSection(items: Preguntas) {
  if (items.length <= PREGUNTAS_ARRIBA) return "";
  return `
<section aria-labelledby="mas-preguntas-titulo" class="mt-9 max-tablet:mt-8">
  <h2 id="mas-preguntas-titulo" class="mb-4 text-[2rem]">Más preguntas a Carlos</h2>
  ${preguntasTarjetas(items.slice(PREGUNTAS_ARRIBA), PREGUNTAS_ARRIBA)}
</section>`;
}
