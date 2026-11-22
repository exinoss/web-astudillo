import { vigilarCambios } from "../../../../lib/comun/cambios";
import { alCambiarAvisos, avisosActuales } from "../../../../lib/comun/avisos";
import { sinMovimiento } from "../../../../lib/comun/movimiento";
import { videoLinkProblem, videoSource } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/reproductor";
import { marcarNoInsertable, videoRechazado } from "../../../../lib/cuenta/panel/campos-video";
import { adminApi, type AboutCarlosPageBody, type AboutCarlosSlug, type DraftAboutCarlosPage } from "../../../../lib/data/http/admin-api";
import type { Editor, Section, SectionEditor } from "./comun";
import { interview } from "./entrevista";
import { gallery } from "./galeria";
import { entrevistasVideo, esEntrevista, nombreVideo, ordenarVideos, video } from "./video";
import { PAGINAS_CARLOS } from "../../../../../../backend/src/contracts/acerca-de-carlos";
import { acciones, avisarVacios, avisoBorrador, busy, card, esc, guardarYRecargar, iconSvg, isPending, PESTANA, PESTANA_NORMAL, selector, state } from "../ui";

const SECTIONS: Record<Section, SectionEditor & { name: string }> = {
  video: { name: "Videos", ...video },
  entrevistas: { name: "Entrevistas", ...entrevistasVideo },
  preguntas: { name: "Preguntas", ...interview },
  galeria: { name: "Galería", ...gallery },
};

const PAGES: Record<AboutCarlosSlug, { name: string; sections: Section[] }> = {
  "por-que-quiero-ser-alcalde": { name: PAGINAS_CARLOS["por-que-quiero-ser-alcalde"], sections: ["video", "entrevistas"] },
  "conoce-mas": { name: PAGINAS_CARLOS["conoce-mas"], sections: ["video", "preguntas", "galeria"] },
};
let slug: AboutCarlosSlug = "por-que-quiero-ser-alcalde";
let section: Section = "video";
// Una copia por página: cambiar de página o de sección no pierde lo escrito.
const working: Partial<Record<AboutCarlosSlug, DraftAboutCarlosPage>> = {};
const TAB_AVISO = "inline-flex items-center gap-1.5 border-error text-error aria-pressed:border-error aria-pressed:bg-error";
let enfocarEnlace: number | null = null;
let marcados = "";
let refrescar: (() => void) | null = null;

/** Pestaña donde se edita el video: «Entrevistas» si tiene medio. */
const seccionDe = (v?: DraftAboutCarlosPage["videos"][number]): Section => (v && esEntrevista(v) ? "entrevistas" : "video");

/** «del video 2» o «de la entrevista 1». */
function delVideo(videos: DraftAboutCarlosPage["videos"], i: number) {
  const nombre = nombreVideo(videos, i).toLowerCase();
  return esEntrevista(videos[i]) ? `de la ${nombre}` : `del ${nombre}`;
}

/** Avisos de la campana sobre los videos publicados de esa página. */
const avisosDe = (s: AboutCarlosSlug) => avisosActuales().filter((a) => a.clave.startsWith(`video:${s}:`));

/** Abre la sección de videos de la página del aviso, con el foco en el enlace del video `numero`. */
export function abrirVideo(pagina: string, numero: number) {
  if (!(pagina in PAGES)) return;
  slug = pagina as AboutCarlosSlug;
  section = "video";
  enfocarEnlace = Number.isInteger(numero) && numero > 0 ? numero - 1 : 0;
}

// Cuando aparece o se resuelve un aviso de video, se vuelve a pintar conservando lo escrito.
alCambiarAvisos((avisos) => {
  const ahora = avisos.filter((a) => a.clave.startsWith("video:")).map((a) => a.clave).join();
  if (ahora === marcados) return;
  marcados = ahora;
  refrescar?.();
});

/** El borrador con los videos antes que las entrevistas, el orden en que se guardan. */
const conVideosOrdenados = (p: DraftAboutCarlosPage) => ({ ...p, videos: ordenarVideos(p.videos) });

/** Página del borrador tal como la recibe la API. */
const toBody = (p: DraftAboutCarlosPage): AboutCarlosPageBody => ({
  videos: ordenarVideos(p.videos).map((v) => ({ titulo: v.titulo, descripcion: v.descripcion, enlace: v.enlace, vertical: v.vertical, idPortada: v.portada?.idMedio ?? null, medio: v.medio ?? null })),
  entrevista: p.entrevista,
  galeria: p.galeria.map(({ foto, ...g }) => ({ ...g, idMedio: foto.idMedio })),
});

/** Primer problema que impide guardar la página, si lo hay. */
function problem(p: DraftAboutCarlosPage) {
  const sinTitulo = p.videos.findIndex((v) => !v.titulo);
  if (sinTitulo >= 0) return `Escribe el título ${delVideo(p.videos, sinTitulo)}.`;
  const sinMedio = p.videos.findIndex((v) => esEntrevista(v) && !v.medio?.trim());
  if (sinMedio >= 0) return `Escribe el medio ${delVideo(p.videos, sinMedio)}.`;
  const malEnlace = p.videos.findIndex((v) => !videoSource(v.enlace));
  if (malEnlace >= 0) return `${nombreVideo(p.videos, malEnlace)}: ${videoLinkProblem(p.videos[malEnlace].enlace)}`;
  if (p.entrevista.some((e) => !e.pregunta || !e.respuesta)) return "Completa la pregunta y la respuesta de cada entrada de la entrevista.";
  if (p.galeria.some((g) => !g.alt || !g.pie)) return "Completa la descripción y el pie de cada foto de la galería.";
  return null;
}

/** Pinta el editor de la página «Acerca de Carlos» elegida. */
export function renderAboutCarlos(root: HTMLElement) {
  const info = PAGES[slug];
  const page = (working[slug] ??= conVideosOrdenados(structuredClone(state.draft!.acercaDeCarlos[slug])));
  if (enfocarEnlace !== null) section = seccionDe(page.videos[enfocarEnlace]);
  if (!info.sections.includes(section)) section = "video";
  const editor: Editor = { slug, page, rerender: () => renderAboutCarlos(root) };
  const avisos = avisosDe(slug);
  const tabs = info.sections.map((id) => {
    const marcada = avisos.some((a) => seccionDe(page.videos.find((v) => v.enlace === a.valor)) === id);
    return `<button type="button" data-acerca-seccion="${id}" aria-pressed="${id === section}" class="${PESTANA} ${marcada ? TAB_AVISO : PESTANA_NORMAL}"${marcada ? ` aria-label="${SECTIONS[id].name}, tiene un aviso"` : ""}>${SECTIONS[id].name}${marcada ? iconSvg("alert", 16) : ""}</button>`;
  }).join("");
  root.innerHTML = `
    ${selector("acerca-pagina", "Página", Object.entries(PAGES).map(([id, p]) => `<option value="${id}" ${id === slug ? "selected" : ""}>${esc(p.name)}${avisosDe(id as AboutCarlosSlug).length ? " · Revisar los videos" : ""}</option>`).join(""))}
    ${card(info.name, `
      ${avisoBorrador(isPending("Página", info.name))}
      <nav aria-label="Contenido de la página" class="mb-6 flex flex-wrap gap-2">${tabs}</nav>
      <form id="acerca-form" novalidate>
        ${SECTIONS[section].html(editor)}
      ${acciones(`/acerca-de-nosotros/${slug}/`, "mt-6")}
      </form>`)}`;
  bind(root, editor);
  if (section !== "video" && section !== "entrevistas") return;
  // Cada enlace se marca mientras el borrador tenga el mismo que se publicó.
  for (const aviso of avisos) {
    const i = page.videos.findIndex((v) => v.enlace === aviso.valor);
    if (aviso.detalle && i >= 0) marcarNoInsertable(root, i, aviso.detalle);
  }
  if (enfocarEnlace === null) return;
  const enlace = root.querySelector<HTMLInputElement>(`#video-enlace-${enfocarEnlace}`) ?? root.querySelector<HTMLInputElement>("#video-enlace-0");
  enfocarEnlace = null;
  enlace?.scrollIntoView({ block: "center", behavior: sinMovimiento() ? "auto" : "smooth" });
  enlace?.focus({ preventScroll: true });
}

/** Conecta los controles del editor. */
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
        const rechazo = videoRechazado(error, editor.page.videos.map((v) => v.enlace));
        if (!rechazo) throw error;
        const { i, texto } = rechazo;
        section = seccionDe(editor.page.videos[i]);
        renderAboutCarlos(root);
        marcarNoInsertable(root, i, texto);
        throw new Error(`Revisa el enlace ${delVideo(editor.page.videos, i)}.`);
      }
    }, () => {
      delete working[saving];
      renderAboutCarlos(root);
    }));
  });
}
