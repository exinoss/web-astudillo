import { statsRepository } from "../../lib/data/stats";
import type { SiteStats } from "../../lib/data/stats-repository";
import { inDraftPreview } from "../../lib/comun/vista-previa";

const formato = new Intl.NumberFormat("es-EC");
const banda = document.querySelector<HTMLElement>("[data-cifras]");
const cifras = [...document.querySelectorAll<HTMLElement>("[data-cifra]")];

function contar(el: HTMLElement, final: number) {
  if (document.documentElement.classList.contains("reduce-motion")) {
    el.textContent = formato.format(final);
    return;
  }
  const inicio = performance.now();
  const paso = (ahora: number) => {
    const avance = Math.min(1, (ahora - inicio) / 1400);
    el.textContent = formato.format(Math.round(final * (1 - (1 - avance) ** 3)));
    if (avance < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

if (banda) {
  const vivas = inDraftPreview() ? Promise.resolve(null) : statsRepository.current();
  const vista = new IntersectionObserver(async ([entrada]) => {
    if (!entrada.isIntersecting) return;
    vista.disconnect();
    const actuales = await vivas;
    for (const el of cifras) {
      const final = actuales?.[el.dataset.cifra as keyof SiteStats] ?? (el.dataset.valor ? Number(el.dataset.valor) : NaN);
      if (Number.isFinite(final)) contar(el, final);
    }
  }, { threshold: 0.5 });
  vista.observe(banda);
}
