import { mountPlayer, videoLinkProblem } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/reproductor";
import { verVideo } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/video";
import { uploadedUrl } from "../../../../lib/comun/fotos";
import { campoEnlace, campoFormato, campoPortada, comprobarEnlace } from "../../../../lib/cuenta/panel/campos-video";
import { adminApi, type DraftAboutCarlosPage } from "../../../../lib/data/http/admin-api";
import { busy, DANGER, esc, field, GHOST, GRUPO, HINT, iconSvg, LARGOS, notify, subirBajar, value } from "../ui";
import { MAX_ENTREVISTAS_VIDEO, MAX_VIDEOS_CARLOS } from "../../../../../../backend/src/contracts/acerca-de-carlos";
import { bindListActions, onFiles, type Editor, type SectionEditor } from "./comun";

type Video = DraftAboutCarlosPage["videos"][number];

/** Una entrevista lleva `medio` (vacío mientras se escribe); un video, no. */
export const esEntrevista = (v: Video) => v.medio != null;

/** Videos primero y entrevistas después, como se guardan: cada pestaña mueve los suyos dentro de su bloque. */
export const ordenarVideos = (videos: Video[]) => [...videos.filter((v) => !esEntrevista(v)), ...videos.filter(esEntrevista)];

/** «Video 2» o «Entrevista 1»: el número cuenta dentro de su pestaña. */
export function nombreVideo(videos: Video[], i: number) {
  const entrevista = esEntrevista(videos[i]);
  const n = videos.slice(0, i + 1).filter((v) => esEntrevista(v) === entrevista).length;
  return `${entrevista ? "Entrevista" : "Video"} ${n}`;
}

/** Recuadro de un video o una entrevista: sus campos, su portada y su vista previa; `mover` son sus botones de subir y bajar. */
function videoHtml(v: Video, i: number, nombre: string, mover: string) {
  const entrevista = esEntrevista(v);
  return `
  <fieldset class="${GRUPO} flex flex-col gap-4">
    <legend class="px-1 text-sm font-bold">${nombre}</legend>
    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-8 max-tablet:grid-cols-1">
      <div class="flex min-w-0 flex-col gap-[18px]">
        ${entrevista ? field({ id: `video-medio-${i}`, label: "Medio", value: v.medio ?? "", max: LARGOS.acercaDeCarlos.medio, hint: "Por ejemplo, Bambero TV.", required: true }) : ""}
        ${field({ id: `video-titulo-${i}`, label: "Título", value: v.titulo, max: LARGOS.acercaDeCarlos.tituloVideo, required: true })}
        ${entrevista ? "" : field({ id: `video-descripcion-${i}`, label: "Texto breve (opcional)", value: v.descripcion ?? "", max: LARGOS.acercaDeCarlos.descripcionVideo, area: true, hint: "Hasta 200 caracteres." })}
        ${campoEnlace(i, v.enlace)}
        ${campoFormato(i, v.vertical)}
        ${campoPortada(i, v.portada)}
      </div>
      <aside class="min-w-0" aria-label="Vista previa: ${nombre}">
        <strong class="mb-3 block text-[0.85rem]">Vista previa</strong>
        <div id="video-escenario-${i}" class="relative mx-auto w-full overflow-hidden rounded-[12px] bg-primary ${v.vertical ? "aspect-[9/16] max-w-[300px]" : "aspect-video"}">
          ${v.portada ? `<img src="${esc(uploadedUrl(v.portada, v.portada.anchos.at(-1)!))}" alt="" class="absolute inset-0 h-full w-full object-cover object-[50%_25%]" />` : ""}
          <button data-video-test="${i}" type="button" class="group absolute inset-0 z-10 flex items-end p-4 text-left text-white [background:linear-gradient(to_top,#063176e6_0%,transparent_45%)]">
            ${verVideo("Ver video")}
          </button>
        </div>
        <p class="mt-3 mb-0 text-center text-[0.75rem]">Comprueba que el video se reproduce aquí antes de guardar.</p>
      </aside>
    </div>
    <div class="flex flex-wrap gap-1">
      ${mover}
      <button type="button" class="${DANGER}" data-remove="video" data-index="${i}">${iconSvg("trash", 18)} Quitar ${entrevista ? "entrevista" : "video"}</button>
    </div>
  </fieldset>`;
}

/** Enlaza los campos del video `i`: detecta su plataforma y liga la portada a su enlace. */
function bindVideo(form: HTMLElement, editor: Editor, i: number, capture: () => void) {
  const input = form.querySelector<HTMLInputElement>(`#video-enlace-${i}`)!;
  const stage = form.querySelector<HTMLElement>(`#video-escenario-${i}`)!;
  const play = form.querySelector<HTMLButtonElement>(`[data-video-test="${i}"]`)!;
  const auto = form.querySelector<HTMLButtonElement>(`[data-video-cover-auto="${i}"]`)!;
  const formato = () => form.querySelector<HTMLInputElement>(`[name="video-formato-${i}"]:checked`)?.value === "vertical";
  let last = input.value;
  /** Vuelve a pintar el editor y devuelve el foco al campo que lo tenía (por su id o, en un radio, por su nombre y valor). */
  const repintar = () => {
    const activo = form.ownerDocument.activeElement as HTMLInputElement | null;
    const selector = activo?.id ? `#${CSS.escape(activo.id)}` : activo?.name ? `[name="${CSS.escape(activo.name)}"][value="${CSS.escape(activo.value)}"]` : "";
    editor.rerender();
    if (selector) form.ownerDocument.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  };
  const layout = () => {
    const vertical = formato();
    stage.classList.toggle("aspect-[9/16]", vertical);
    stage.classList.toggle("max-w-[300px]", vertical);
    stage.classList.toggle("aspect-video", !vertical);
  };
  const detect = () => {
    const source = comprobarEnlace(form, i, input.value !== last);
    if (input.value !== last) { stage.querySelector("iframe, video")?.remove(); play.hidden = false; }
    last = input.value;
    layout();
    return source;
  };
  const coverFromVideo = (button: HTMLButtonElement | null) => {
    const source = detect();
    if (!source || source.provider === "mp4") return;
    capture();
    const page = editor.page, video = page.videos[i], enlace = input.value.trim();
    void busy(button, async () => {
      const foto = await adminApi.videoCover(enlace);
      // Si mientras tanto cambió el enlace, la página o el orden, esta imagen ya no corresponde.
      if (editor.page !== page || page.videos[i] !== video || video.enlace !== enlace) return;
      video.portada = foto;
      repintar();
      notify("Se usa la imagen del video como portada. Puedes cambiarla por otra.");
    }, "Cargando la imagen…");
  };
  let enlaceDeLaPortada = input.value.trim();
  input.addEventListener("input", detect);
  input.addEventListener("change", () => {
    if (input.value.trim() === enlaceDeLaPortada) return;
    enlaceDeLaPortada = input.value.trim();
    capture();
    const habia = Boolean(editor.page.videos[i].portada);
    editor.page.videos[i].portada = null;
    coverFromVideo(null);
    if (habia) repintar();
  });
  auto.addEventListener("click", () => coverFromVideo(auto));
  form.querySelectorAll(`[name="video-formato-${i}"]`).forEach((r) => r.addEventListener("change", layout));
  play.addEventListener("click", () => {
    const source = detect();
    if (!source) { notify(videoLinkProblem(input.value), true); return input.focus(); }
    mountPlayer(stage, source, `Vista previa del video ${i + 1}`);
    play.hidden = true;
  });
  onFiles(form.querySelector(`#video-portada-${i}`), 1, (foto) => { capture(); editor.page.videos[i].portada = foto; }, editor, capture);
  form.querySelector(`[data-video-cover-remove="${i}"]`)?.addEventListener("click", () => {
    capture();
    editor.page.videos[i].portada = null;
    editor.rerender();
  });
  detect();
}

/** Pestaña «Videos» o «Entrevistas»: la misma lista de la página, cada una con su bloque. */
function videoEditor(entrevistas: boolean): SectionEditor {
  const propios = (editor: Editor) => editor.page.videos.flatMap((v, i) => (esEntrevista(v) === entrevistas ? [i] : []));
  const seccion: SectionEditor = {
    html(editor: Editor) {
      const list = editor.page.videos, indices = propios(editor);
      const videos = list.length - list.filter(esEntrevista).length;
      // Los videos ocupan [0, videos) y las entrevistas [videos, total): nadie sale de su bloque al moverse.
      const mover = (i: number) => entrevistas ? subirBajar("video", i, list.length, nombreVideo(list, i).toLowerCase(), videos) : subirBajar("video", i, videos, nombreVideo(list, i).toLowerCase());
      const max = entrevistas ? MAX_ENTREVISTAS_VIDEO : MAX_VIDEOS_CARLOS;
      const vacio = entrevistas ? "Aún no hay entrevistas." : "Aún no hay videos.";
      return `<div class="flex flex-col gap-5">${indices.map((i) => videoHtml(list[i], i, nombreVideo(list, i), mover(i))).join("") || `<p class="m-0 text-[0.9rem]">${vacio}</p>`}
      ${indices.length < max ? `<button type="button" data-video-add class="${GHOST} self-start">${iconSvg("plus", 17)} Añadir ${entrevistas ? "entrevista" : "video"}</button>` : ""}
      <p class="${HINT}">${entrevistas ? `Hasta ${max} entrevistas. Se muestran en este orden, en la sección «Entrevistas».` : `Hasta ${max} videos. Se muestran en este orden.`}</p></div>`;
    },
    capture(form: HTMLElement, editor: Editor) {
      editor.page.videos.forEach((v, i) => {
        if (!form.querySelector(`#video-enlace-${i}`)) return;
        v.titulo = value(form, `#video-titulo-${i}`);
        if (form.querySelector(`#video-descripcion-${i}`)) v.descripcion = value(form, `#video-descripcion-${i}`) || null;
        if (form.querySelector(`#video-medio-${i}`)) v.medio = value(form, `#video-medio-${i}`);
        v.enlace = value(form, `#video-enlace-${i}`);
        v.vertical = form.querySelector<HTMLInputElement>(`[name="video-formato-${i}"]:checked`)?.value === "vertical";
      });
    },
    bind(form: HTMLElement, editor: Editor) {
      const capture = () => seccion.capture(form, editor);
      form.querySelector("[data-video-add]")?.addEventListener("click", () => {
        capture();
        const list = editor.page.videos;
        const nuevo: Video = { titulo: "", descripcion: null, enlace: "", vertical: false, portada: null, medio: entrevistas ? "" : null };
        const i = entrevistas ? list.length : list.length - list.filter(esEntrevista).length;
        list.splice(i, 0, nuevo);
        editor.rerender();
        form.ownerDocument.querySelector<HTMLInputElement>(`#video-${entrevistas ? "medio" : "titulo"}-${i}`)?.focus();
      });
      bindListActions(form, editor, capture);
      propios(editor).forEach((i) => bindVideo(form, editor, i, capture));
    },
  };
  return seccion;
}

export const video = videoEditor(false);
export const entrevistasVideo = videoEditor(true);
