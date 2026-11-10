import { mountPlayer, videoLinkProblem, videoSource } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/reproductor";
import { verVideo } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/video";
import { uploadedUrl } from "../../../../lib/comun/fotos";
import { adminApi } from "../../../../lib/data/http/admin-api";
import { VIDEO_URL_MAX } from "../../../../../../backend/src/contracts/video";
import { busy, DANGER, esc, field, GHOST, GRUPO, HINT, iconSvg, LABEL, LARGOS, LEYENDA, notify, thumb, upload, value } from "../ui";
import { onFiles, radios, type Editor, type SectionEditor } from "./comun";

const PROVIDERS = { youtube: "YouTube", facebook: "Facebook", tiktok: "TikTok", vimeo: "Vimeo", mp4: "Archivo MP4" };
const EMPTY_VIDEO = { titulo: "", descripcion: null, enlace: "", vertical: false, portada: null };

/** Marca el enlace con el aviso de la plataforma que no deja mostrar el video; cambiar el enlace lo quita. */
export function marcarNoInsertable(root: ParentNode, mensaje: string) {
  const input = root.querySelector<HTMLInputElement>("#video-enlace"), status = root.querySelector<HTMLElement>("#video-detectado");
  if (!input || !status) return;
  status.textContent = mensaje;
  status.classList.add("text-error");
  input.removeAttribute("data-valido");
  input.setAttribute("aria-invalid", "true");
}

export const video: SectionEditor = {
  html(editor: Editor) {
    const v = editor.page.video ?? EMPTY_VIDEO;
    const fromVideo = `<button type="button" data-video-cover-auto class="${GHOST}" hidden>${iconSvg("image", 17)} Usar la imagen del video</button>`;
    const cover = v.portada
      ? `<div class="flex flex-wrap items-center gap-3"><img src="${esc(thumb(v.portada))}" alt="" class="h-20 w-14 rounded-control object-cover" />${upload("video-portada", "Cambiar portada")}${fromVideo}<button type="button" data-video-cover-remove class="${GHOST}">Quitar portada</button></div>`
      : `<div class="flex flex-wrap items-center gap-3">${upload("video-portada", "Subir portada")}${fromVideo}</div>`;
    return `<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-8 max-tablet:grid-cols-1">
      <div class="flex min-w-0 flex-col gap-[18px]">
        ${field({ id: "video-titulo", label: "Título de la sección", value: v.titulo, max: LARGOS.acercaDeCarlos.tituloVideo , required: !!editor.page.video })}
        ${field({ id: "video-descripcion", label: "Texto breve (opcional)", value: v.descripcion ?? "", max: LARGOS.acercaDeCarlos.descripcionVideo, area: true, hint: "Hasta 200 caracteres." })}
        <div>
          ${field({ id: "video-enlace", label: "Enlace del video", value: v.enlace, max: VIDEO_URL_MAX, hint: "Pega el enlace de Facebook, TikTok, YouTube o Vimeo tal como aparece en la barra del navegador al abrir el video." , required: !!editor.page.video })}
          <p id="video-detectado" role="status" class="m-0 mt-2 flex min-h-7 items-center gap-2 text-[0.85rem] font-bold"></p>
          <p id="video-nota" class="${HINT}" hidden>Si usa música con derechos, en el sitio puede verse sin sonido.</p>
        </div>
        <fieldset class="${GRUPO}">
          <legend class="${LEYENDA}">Formato</legend>
          <div class="flex flex-wrap gap-3">${radios("video-formato", [
            ["horizontal", "Horizontal", '<span aria-hidden="true" class="h-3 w-5 rounded-[2px] border-2 border-current"></span>'],
            ["vertical", "Vertical", '<span aria-hidden="true" class="h-5 w-3 rounded-[2px] border-2 border-current"></span>'],
          ], v.vertical ? "vertical" : "horizontal")}</div>
          <p class="${HINT}">Los reels y los videos de TikTok son verticales.</p>
        </fieldset>
        <div><span class="${LABEL}">Portada</span>${cover}<p class="${HINT}">Es la imagen que se ve antes de reproducir. Si no subes una, se usa la del video cuando su plataforma la ofrece. Medida recomendada: 1080 × 1920 px si el video es vertical y 1280 × 720 px si es horizontal. Sin portada se muestra una imagen de la campaña.</p></div>
        ${editor.page.video ? `<div class="border-t border-base-300 pt-3"><button type="button" data-video-remove class="${DANGER}">${iconSvg("trash", 17)} Quitar video de la página</button></div>` : ""}
      </div>
      <aside class="min-w-0" aria-label="Vista previa del video">
        <strong class="mb-3 block text-[0.85rem]">Vista previa</strong>
        <div id="video-escenario" class="relative mx-auto w-full overflow-hidden rounded-[12px] bg-primary ${v.vertical ? "aspect-[9/16] max-w-[300px]" : "aspect-video"}">
          ${v.portada ? `<img src="${esc(uploadedUrl(v.portada, v.portada.anchos.at(-1)!))}" alt="" class="absolute inset-0 h-full w-full object-cover object-[50%_25%]" />` : ""}
          <button data-video-test type="button" class="group absolute inset-0 z-10 flex items-end p-4 text-left text-white [background:linear-gradient(to_top,#063176e6_0%,transparent_45%)]">
            ${verVideo("Ver video")}
          </button>
        </div>
        <p class="mt-3 mb-0 text-center text-[0.75rem]">Comprueba que el video se reproduce aquí antes de guardar.</p>
      </aside>
    </div>`;
  },
  capture(form: HTMLElement, editor: Editor) {
    if (!form.querySelector("#video-enlace")) return;
    const enlace = value(form, "#video-enlace"), titulo = value(form, "#video-titulo"), descripcion = value(form, "#video-descripcion");
    const portada = editor.page.video?.portada ?? null;
    editor.page.video = enlace || titulo || descripcion || portada ? {
      titulo, descripcion: descripcion || null, enlace, portada,
      vertical: form.querySelector<HTMLInputElement>('[name="video-formato"]:checked')?.value === "vertical",
    } : null;
  },
  bind(form: HTMLElement, editor: Editor) {
    const capture = () => video.capture(form, editor);
    const input = form.querySelector<HTMLInputElement>("#video-enlace")!;
    const status = form.querySelector<HTMLElement>("#video-detectado")!;
    const stage = form.querySelector<HTMLElement>("#video-escenario")!;
    const play = form.querySelector<HTMLButtonElement>("[data-video-test]")!;
    const auto = form.querySelector<HTMLButtonElement>("[data-video-cover-auto]")!;
    let last = input.value;
    const layout = () => {
      const vertical = form.querySelector<HTMLInputElement>('[name="video-formato"]:checked')?.value === "vertical";
      stage.classList.toggle("aspect-[9/16]", vertical);
      stage.classList.toggle("max-w-[300px]", vertical);
      stage.classList.toggle("aspect-video", !vertical);
    };
    const detect = () => {
      const text = input.value.trim();
      const source = text ? videoSource(text) : null;
      if (source) status.innerHTML = `<span aria-hidden="true" class="grid size-7 shrink-0 place-items-center rounded-full bg-success text-white">${iconSvg("check", 17)}</span><span class="text-success">Enlace válido · ${PROVIDERS[source.provider]}</span>`;
      else status.textContent = text ? videoLinkProblem(text) : "";
      status.classList.toggle("text-error", Boolean(text) && !source);
      input.setAttribute("aria-invalid", String(Boolean(text) && !source));
      input.toggleAttribute("data-valido", Boolean(source));
      form.querySelector<HTMLElement>("#video-nota")!.hidden = source?.provider !== "tiktok";
      if (source && input.value !== last) form.querySelectorAll<HTMLInputElement>('[name="video-formato"]').forEach((r) => { r.checked = (r.value === "vertical") === source.vertical; });
      if (input.value !== last) { stage.querySelector("iframe, video")?.remove(); play.hidden = false; }
      last = input.value;
      auto.hidden = !source || source.provider === "mp4";
      layout();
      return source;
    };
    const coverFromVideo = (button: HTMLButtonElement | null) => {
      const source = detect();
      if (!source || source.provider === "mp4") return;
      capture();
      const page = editor.page, enlace = input.value.trim();
      void busy(button, async () => {
        const foto = await adminApi.videoCover(enlace);
        // Si mientras tanto cambió el enlace o la página, esta imagen ya no corresponde.
        if (editor.page !== page || page.video?.enlace !== enlace) return;
        page.video = { ...page.video, portada: foto };
        editor.rerender();
        notify("Se usa la imagen del video como portada. Puedes cambiarla por otra.");
      }, "Cargando la imagen…");
    };
    input.addEventListener("input", detect);
    input.addEventListener("change", () => { if (!editor.page.video?.portada) coverFromVideo(null); });
    auto.addEventListener("click", () => coverFromVideo(auto));
    form.querySelectorAll('[name="video-formato"]').forEach((r) => r.addEventListener("change", layout));
    play.addEventListener("click", () => {
      const source = detect();
      if (!source) { notify(videoLinkProblem(input.value), true); return input.focus(); }
      mountPlayer(stage, source, "Vista previa del video");
      play.hidden = true;
    });
    onFiles(form.querySelector("#video-portada"), 1, (foto) => { capture(); editor.page.video = { ...(editor.page.video ?? EMPTY_VIDEO), portada: foto }; }, editor, capture);
    form.querySelector("[data-video-cover-remove]")?.addEventListener("click", () => {
      capture();
      if (editor.page.video) editor.page.video.portada = null;
      editor.rerender();
    });
    form.querySelector("[data-video-remove]")?.addEventListener("click", () => {
      editor.page.video = null;
      editor.rerender();
      notify("El video se quitará de la página al guardar y publicar.");
    });
    detect();
  },
};
