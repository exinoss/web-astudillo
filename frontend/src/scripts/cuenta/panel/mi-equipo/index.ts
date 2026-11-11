import { card, PESTANA, PESTANA_NORMAL } from "../ui";
import { renderTeam } from "./equipo";
import { renderParishes } from "./parroquias";

const SUBSECCIONES = { equipo: { nombre: "Equipo", render: renderTeam }, parroquias: { nombre: "Parroquias", render: renderParishes } };
type Subseccion = keyof typeof SUBSECCIONES;
let subseccion: Subseccion = "equipo";

export function renderMyTeam(section: HTMLElement) {
  const botones = Object.entries(SUBSECCIONES).map(([id, s]) => `<button type="button" data-subseccion="${id}" aria-pressed="${id === subseccion}" class="${PESTANA} ${PESTANA_NORMAL}">${s.nombre}</button>`).join("");
  section.innerHTML = card("Mi equipo", `<nav aria-label="Contenido de la página" class="mb-6 flex flex-wrap gap-2">${botones}</nav><div data-contenido></div>`);
  const capturar = SUBSECCIONES[subseccion].render(section.querySelector<HTMLElement>("[data-contenido]")!, () => renderMyTeam(section));
  section.querySelectorAll<HTMLButtonElement>("[data-subseccion]").forEach((boton) => boton.addEventListener("click", () => {
    capturar();
    subseccion = boton.dataset.subseccion as Subseccion;
    renderMyTeam(section);
  }));
}
