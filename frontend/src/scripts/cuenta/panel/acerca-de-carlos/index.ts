import { vigilarCambios } from "../../../../lib/cuenta/panel/cambios";
import { videoLinkProblem, videoSource } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/reproductor";
import { adminApi, type AboutCarlosPageBody, type AboutCarlosSlug, type DraftAboutCarlosPage } from "../../../../lib/data/http/admin-api";
import type { Editor, Section, SectionEditor } from "./comun";
import { interview } from "./entrevista";
import { gallery } from "./galeria";
import { portrait } from "./retrato";
import { cards } from "./tarjetas";
import { video } from "./video";
import { busy, card, DRAFT_PILL, esc, isPending, notify, previewButton, reloadDraft, reloadPending, state } from "../ui";

const SECTIONS: Record<Section, SectionEditor & { name: string }> = {
  tarjetas: { name: "Tarjetas", ...cards },
  video: { name: "Video", ...video },
  retrato: { name: "Retrato", ...portrait },
  entrevista: { name: "Entrevista", ...interview },
  galeria: { name: "Galería", ...gallery },
};

const PAGES: Record<AboutCarlosSlug, { name: string; sections: Section[] }> = {
  "por-que-quiero-ser-alcalde": { name: "Por qué quiero ser alcalde", sections: ["tarjetas", "video"] },
  "conoce-mas": { name: "Conoce más sobre Carlos", sections: ["tarjetas", "video", "retrato", "entrevista", "galeria"] },
};
let slug: AboutCarlosSlug = "por-que-quiero-ser-alcalde";
let section: Section = "tarjetas";
// Una copia por página: cambiar de página o de sección no pierde lo escrito.
const working: Partial<Record<AboutCarlosSlug, DraftAboutCarlosPage>> = {};

const toBody = (p: DraftAboutCarlosPage): AboutCarlosPageBody => ({
  tarjetas: p.tarjetas.map(({ foto, ...t }) => ({ ...t, idMedio: foto.idMedio })),
  video: p.video && { titulo: p.video.titulo, descripcion: p.video.descripcion, enlace: p.video.enlace, vertical: p.video.vertical, idPortada: p.video.portada?.idMedio ?? null },
  retrato: p.retrato && { idMedio: p.retrato.foto.idMedio, alt: p.retrato.alt },
  entrevista: p.entrevista,
  galeria: p.galeria.map(({ foto, ...g }) => ({ ...g, idMedio: foto.idMedio })),
});

function problem(p: DraftAboutCarlosPage) {
  if (p.tarjetas.some((t) => !t.titulo || !t.texto || !t.alt)) return "Completa el título, el texto y la descripción de la foto de cada tarjeta.";
  if (p.video && !p.video.titulo) return "Escribe el título de la sección del video.";
  if (p.video && !videoSource(p.video.enlace)) return videoLinkProblem(p.video.enlace);
  if (p.retrato && !p.retrato.alt) return "Describe la foto del retrato.";
  if (p.entrevista.some((e) => !e.pregunta || !e.respuesta)) return "Completa la pregunta y la respuesta de cada entrada de la entrevista.";
  if (p.galeria.some((g) => !g.alt || !g.pie)) return "Completa la descripción y el pie de cada foto de la galería.";
  return null;
}

export function renderAboutCarlos(root: HTMLElement) {
  const info = PAGES[slug];
  const page = (working[slug] ??= structuredClone(state.draft!.acercaDeCarlos[slug]));
  if (!info.sections.includes(section)) section = "tarjetas";
  const editor: Editor = { slug, page, rerender: () => renderAboutCarlos(root) };
  const tabs = info.sections.map((id) => `<button type="button" data-acerca-seccion="${id}" aria-pressed="${id === section}" class="min-h-11 rounded-[3px] border border-base-300 bg-base-100 px-4 text-[0.82rem] font-bold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white">${SECTIONS[id].name}</button>`).join("");
  root.innerHTML = `
    <div class="mb-5 flex items-center gap-3.5 max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-1.5">
      <label for="acerca-pagina" class="text-[0.82rem] font-bold">Página</label>
      <select id="acerca-pagina" class="min-h-12 min-w-[320px] rounded-[3px] border border-field-border bg-base-100 px-3.5 text-sm text-primary max-tablet:min-w-0">
        ${Object.entries(PAGES).map(([id, p]) => `<option value="${id}" ${id === slug ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
      </select>
    </div>
    ${card(info.name, `
      ${isPending("Página", info.name) ? `<p class="-mt-2 mb-5"><span class="${DRAFT_PILL}">Borrador sin publicar</span></p>` : ""}
      <nav aria-label="Contenido de la página" class="mb-6 flex flex-wrap gap-2">${tabs}</nav>
      <form id="acerca-form" novalidate>
        ${SECTIONS[section].html(editor)}
        <div class="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-t-base-300 pt-[18px] max-tablet:flex-col-reverse">
          ${previewButton(`/acerca-de-nosotros/${slug}/`)}
          <button type="submit" class="button">Guardar borrador</button>
        </div>
      </form>`)}`;
  bind(root, editor);
}

function bind(root: HTMLElement, editor: Editor) {
  const form = root.querySelector<HTMLFormElement>("#acerca-form")!;
  const capture = () => SECTIONS[section].capture(form, editor);
  root.querySelector<HTMLSelectElement>("#acerca-pagina")!.addEventListener("change", (e) => {
    capture();
    slug = (e.target as HTMLSelectElement).value as AboutCarlosSlug;
    renderAboutCarlos(root);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-acerca-seccion]").forEach((b) => b.addEventListener("click", () => {
    capture();
    section = b.dataset.acercaSeccion as Section;
    renderAboutCarlos(root);
  }));
  SECTIONS[section].bind(form, editor);
  const submit = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  vigilarCambios(form, submit, toBody(state.draft!.acercaDeCarlos[slug]), () => { capture(); return toBody(editor.page); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capture();
    const message = problem(editor.page);
    if (message) return notify(message, true);
    const saving = slug;
    void busy(submit, async () => {
      await adminApi.saveAboutCarlosPage(saving, toBody(editor.page), state.draft!.versiones.acercaDeCarlos[saving]);
      await Promise.all([reloadDraft(), reloadPending()]);
      delete working[saving];
      renderAboutCarlos(root);
      notify(`Borrador de «${PAGES[saving].name}» guardado. Publica para que se vea en el sitio.`);
    });
  });
}
