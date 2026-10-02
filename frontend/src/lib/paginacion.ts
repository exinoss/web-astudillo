import { esc } from "./html";

export interface PageInfo {
  total: number;
  pagina: number;
  porPagina: number;
}

const ARROW = (turn: number) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" transform="rotate(${turn} 12 12)"/></svg>`;
const BUTTON =
  "grid min-h-11 min-w-11 place-items-center rounded-[3px] border border-base-300 px-1.5 text-[0.85rem] font-bold text-primary hover:bg-base-200 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-content";

/** Páginas visibles: todas si son pocas; si no, primeras, vecinas de la actual y última. */
function visiblePages(current: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, 2, current - 1, current, current + 1, last]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i && p - sorted[i - 1] > 1 ? ["…" as const, p] : [p]));
}

export function renderPagination(container: HTMLElement, info: PageInfo, onChange: (page: number) => void) {
  const last = Math.max(1, Math.ceil(info.total / info.porPagina));
  const current = Math.min(info.pagina, last);
  if (info.total <= info.porPagina) {
    container.innerHTML = "";
    return;
  }
  const from = (current - 1) * info.porPagina + 1;
  const to = Math.min(current * info.porPagina, info.total);
  container.innerHTML = `
    <nav aria-label="Paginación" class="flex items-center justify-between gap-4 pt-4 max-tablet:gap-2.5">
      <span class="text-[0.82rem] text-[#50617d] max-tablet:hidden">Mostrando <strong class="text-primary">${from}–${to}</strong> de <strong class="text-primary">${info.total}</strong></span>
      <span class="flex items-center gap-1.5 max-tablet:w-full max-tablet:justify-between">
        <button type="button" class="${BUTTON}" data-pagina="${current - 1}" aria-label="Página anterior" ${current === 1 ? "disabled" : ""}>${ARROW(90)}</button>
        <span class="hidden text-center text-[0.82rem] max-tablet:block"><strong>Página ${current} de ${last}</strong><br><span class="text-[#50617d]">${from}–${to} de ${info.total}</span></span>
        ${visiblePages(current, last).map((p) => p === "…"
          ? `<span class="px-1 text-[#50617d] max-tablet:hidden" aria-hidden="true">…</span>`
          : `<button type="button" class="${BUTTON} max-tablet:hidden" data-pagina="${p}" aria-label="Página ${p}" ${p === current ? 'aria-current="page"' : ""}>${esc(p)}</button>`).join("")}
        <button type="button" class="${BUTTON}" data-pagina="${current + 1}" aria-label="Página siguiente" ${current === last ? "disabled" : ""}>${ARROW(-90)}</button>
      </span>
    </nav>`;
  container.querySelectorAll<HTMLButtonElement>("button[data-pagina]").forEach((button) =>
    button.addEventListener("click", () => onChange(Number(button.dataset.pagina))));
}
