import { card } from "../ui";
import { renderTeam } from "./equipo";
import { renderParishes } from "./parroquias";

const SUBSECCIONES = { equipo: { nombre: "Equipo", render: renderTeam }, parroquias: { nombre: "Parroquias", render: renderParishes } };
type Subseccion = keyof typeof SUBSECCIONES;
let subseccion: Subseccion = "equipo";

export function renderMyTeam(section: HTMLElement) {
  const botones = Object.entries(SUBSECCIONES).map(([id, s]) => `<button type="button" data-subseccion="${id}" aria-pressed="${id === subseccion}" class="min-h-11 rounded-[3px] border border-base-300 bg-base-100 px-4 text-[0.82rem] font-bold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white">${s.nombre}</button>`).join("");
  section.innerHTML = card("Mi equipo", `<nav aria-label="Contenido de la página" class="mb-6 flex flex-wrap gap-2">${botones}</nav><div data-contenido></div>`);
  const capturar = SUBSECCIONES[subseccion].render(section.querySelector<HTMLElement>("[data-contenido]")!, () => renderMyTeam(section));
  section.querySelectorAll<HTMLButtonElement>("[data-subseccion]").forEach((boton) => boton.addEventListener("click", () => {
    capturar();
    subseccion = boton.dataset.subseccion as Subseccion;
    renderMyTeam(section);
  }));
}
