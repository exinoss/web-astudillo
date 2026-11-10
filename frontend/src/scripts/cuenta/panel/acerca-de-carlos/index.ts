import { vigilarCambios } from "../../../../lib/comun/cambios";
import { alCambiarAvisos, avisosActuales } from "../../../../lib/comun/avisos";
import { sinMovimiento } from "../../../../lib/comun/movimiento";
import { avisoNoInsertable, videoLinkProblem, videoSource } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/reproductor";
import { adminApi, type AboutCarlosPageBody, type AboutCarlosSlug, type DraftAboutCarlosPage } from "../../../../lib/data/http/admin-api";
import type { Editor, Section, SectionEditor } from "./comun";
import { interview } from "./entrevista";
import { gallery } from "./galeria";
import { portrait } from "./retrato";
import { cards } from "./tarjetas";
import { marcarNoInsertable, video } from "./video";
import { PAGINAS_CARLOS } from "../../../../../../backend/src/contracts/acerca-de-carlos";
import { avisarVacios, avisoBorrador, busy, card, esc, guardarYRecargar, iconSvg, isPending, previewButton, state } from "../ui";

const SECTIONS: Record<Section, SectionEditor & { name: string }> = {
  tarjetas: { name: "Tarjetas", ...cards },
  video: { name: "Video", ...video },
  retrato: { name: "Retrato", ...portrait },
  entrevista: { name: "Entrevista", ...interview },
  galeria: { name: "Galería", ...gallery },
};

const PAGES: Record<AboutCarlosSlug, { name: string; sections: Section[] }> = {
  "por-que-quiero-ser-alcalde": { name: PAGINAS_CARLOS["por-que-quiero-ser-alcalde"], sections: ["tarjetas", "video"] },
  "conoce-mas": { name: PAGINAS_CARLOS["conoce-mas"], sections: ["tarjetas", "video", "retrato", "entrevista", "galeria"] },
};
let slug: AboutCarlosSlug = "por-que-quiero-ser-alcalde";
let section: Section = "tarjetas";
// Una copia por página: cambiar de página o de sección no pierde lo escrito.
const working: Partial<Record<AboutCarlosSlug, DraftAboutCarlosPage>> = {};
const TAB = "min-h-11 rounded-[3px] border bg-base-100 px-4 text-[0.82rem] font-bold aria-pressed:text-white";
const TAB_NORMAL = "border-base-300 aria-pressed:border-primary aria-pressed:bg-primary";
const TAB_AVISO = "inline-flex items-center gap-1.5 border-error text-error aria-pressed:border-error aria-pressed:bg-error";
let enfocarEnlace = false;
let marcados = "";
let refrescar: (() => void) | null = null;

/** El aviso de la campana sobre el video publicado de esa página, si lo hay. */
const avisoDe = (s: AboutCarlosSlug) => avisosActuales().find((a) => a.clave === `video:${s}`);

/** Abre la sección Video de la página del aviso, con el foco en su enlace. */
export function abrirVideo(pagina: string) {
  if (!(pagina in PAGES)) return;
  slug = pagina as AboutCarlosSlug;
  section = "video";
  enfocarEnlace = true;
}

// Cuando aparece o se resuelve un aviso de video, se vuelve a pintar conservando lo escrito.
alCambiarAvisos((avisos) => {
  const ahora = avisos.filter((a) => a.clave.startsWith("video:")).map((a) => a.clave).join();
  if (ahora === marcados) return;
  marcados = ahora;
  refrescar?.();
});

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
  const aviso = avisoDe(slug);
  const tabs = info.sections.map((id) => {
    const marcada = id === "video" && aviso;
    return `<button type="button" data-acerca-seccion="${id}" aria-pressed="${id === section}" class="${TAB} ${marcada ? TAB_AVISO : TAB_NORMAL}"${marcada ? ` aria-label="${SECTIONS[id].name}, tiene un aviso"` : ""}>${SECTIONS[id].name}${marcada ? iconSvg("alert", 16) : ""}</button>`;
  }).join("");
  root.innerHTML = `
    <div class="mb-5 flex items-center gap-3.5 max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-1.5">
      <label for="acerca-pagina" class="text-[0.82rem] font-bold">Página</label>
      <select id="acerca-pagina" class="campo min-w-[320px] max-tablet:min-w-0">
        ${Object.entries(PAGES).map(([id, p]) => `<option value="${id}" ${id === slug ? "selected" : ""}>${esc(p.name)}${avisoDe(id as AboutCarlosSlug) ? " · Revisar el video" : ""}</option>`).join("")}
      </select>
    </div>
    ${card(info.name, `
      ${avisoBorrador(isPending("Página", info.name))}
      <nav aria-label="Contenido de la página" class="mb-6 flex flex-wrap gap-2">${tabs}</nav>
      <form id="acerca-form" novalidate>
        ${SECTIONS[section].html(editor)}
        <div class="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-t-base-300 pt-[18px] max-tablet:flex-col-reverse">
          ${previewButton(`/acerca-de-nosotros/${slug}/`)}
          <button type="submit" class="button">Guardar borrador</button>
        </div>
      </form>`)}`;
  bind(root, editor);
  if (section !== "video") return;
  // El campo se marca mientras el borrador tenga el mismo enlace que se publicó.
  if (aviso?.detalle && page.video?.enlace === aviso.valor) marcarNoInsertable(root, aviso.detalle);
  if (!enfocarEnlace) return;
  enfocarEnlace = false;
  const enlace = root.querySelector<HTMLInputElement>("#video-enlace");
  enlace?.scrollIntoView({ block: "center", behavior: sinMovimiento() ? "auto" : "smooth" });
  enlace?.focus({ preventScroll: true });
}

function bind(root: HTMLElement, editor: Editor) {
  const form = root.querySelector<HTMLFormElement>("#acerca-form")!;
  const capture = () => SECTIONS[section].capture(form, editor);
  refrescar = () => {
    if (!root.isConnected || root.closest("[hidden]")) return;
    const foco = root.contains(document.activeElement) ? document.activeElement!.id : "";
    capture();
    renderAboutCarlos(root);
    if (foco) root.querySelector<HTMLElement>(`#${CSS.escape(foco)}`)?.focus({ preventScroll: true });
  };
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
    if (message) {
      editor.rerender();
      return avisarVacios(root, message);
    }
    const saving = slug;
    void busy(submit, () => guardarYRecargar(async () => {
      try {
        await adminApi.saveAboutCarlosPage(saving, toBody(editor.page), state.draft!.versiones.acercaDeCarlos[saving]);
      } catch (error) {
        const source = editor.page.video && videoSource(editor.page.video.enlace);
        const aviso = error instanceof Error && source && (["bloqueado", "no-existe"] as const).map((m) => avisoNoInsertable(source.provider, m)).find((t) => t === error.message);
        if (!aviso) throw error;
        section = "video";
        renderAboutCarlos(root);
        marcarNoInsertable(root, aviso);
        throw new Error("Revisa el enlace del video.");
      }
    }, () => {
      delete working[saving];
      renderAboutCarlos(root);
    }));
  });
}
