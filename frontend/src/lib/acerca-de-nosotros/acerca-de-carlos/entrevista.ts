import { esc, escLines } from "../../comun/html";
import type { AboutCarlosPageView } from "./vista";

export function interviewSection(items: AboutCarlosPageView["interview"]) {
  if (!items.length) return "";
  const paragraphs = (answer: string) => answer.split(/\n\s*\n/)
    .map((p) => `<p class="m-0 mb-3 last:mb-0">${escLines(p)}</p>`).join("");
  return `
<section aria-labelledby="entrevista-titulo" class="mt-9 max-tablet:mt-8">
  <h2 id="entrevista-titulo" class="mb-4 text-[2rem]">Una conversación con Carlos</h2>
  <div class="rounded-[3px] border-t border-base-300 bg-base-100/90">
    ${items.map((item) => `<details data-interview class="group border-b border-base-300">
      <summary class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-1 py-4 text-[0.95rem] font-bold [&::-webkit-details-marker]:hidden">
        ${esc(item.question)}
        <span aria-hidden="true" class="grid size-8 shrink-0 place-items-center rounded-full bg-accent"><span class="group-open:hidden">+</span><span class="hidden group-open:block">−</span></span>
      </summary>
      <div class="mb-5 max-w-[700px] px-1 pr-5 text-[0.95rem] leading-[1.7]">${paragraphs(item.answer)}</div>
    </details>`).join("")}
  </div>
</section>`;
}
