import { VIDEO_URL_MAX } from "../../../../../backend/src/contracts/video";
import { avisoNoInsertable, videoLinkProblem, videoSource } from "../../acerca-de-nosotros/acerca-de-carlos/reproductor";
import { esc } from "../../comun/html";
import { iconSvg } from "../../comun/iconos";
import type { Photo } from "../../data/http/admin-api";
import { field, FILA_BOTONES, GHOST, GRUPO, HINT, ICON_DANGER, LABEL, LEYENDA, thumb, upload } from "./campos";

export const PROVIDERS = { youtube: "YouTube", facebook: "Facebook", tiktok: "TikTok", vimeo: "Vimeo", mp4: "Archivo MP4" };
const RADIO = "flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-base-300 px-3 text-[0.82rem] font-bold has-checked:border-primary has-checked:bg-primary-soft focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-neutral";

/** Opciones de radio como botones, con la marca dibujada antes de cada texto. */
export const radios = (name: string, options: [string, string, string][], checked: string) => options.map(([val, label, mark]) => `
  <label class="${RADIO}"><input type="radio" name="${name}" value="${val}" ${val === checked ? "checked" : ""} class="sr-only" />${mark}${label}</label>`).join("");

/** Campo del enlace del video `n`, con su estado y la nota de TikTok. */
export const campoEnlace = (n: number, valor: string) => `<div>
          ${field({ id: `video-enlace-${n}`, label: "Enlace del video", value: valor, max: VIDEO_URL_MAX, hint: "Pega el enlace de Facebook, TikTok, YouTube o Vimeo tal como aparece en la barra del navegador al abrir el video.", required: true })}
          <p id="video-detectado-${n}" role="status" class="m-0 mt-2 flex min-h-7 items-center gap-2 text-[0.85rem] font-bold"></p>
          <p id="video-nota-${n}" class="${HINT}" hidden>Si usa música con derechos, en el sitio puede verse sin sonido.</p>
        </div>`;

/** Formato horizontal o vertical del video `n`. */
export const campoFormato = (n: number, vertical: boolean) => `<fieldset class="${GRUPO}">
          <legend class="${LEYENDA}">Formato</legend>
          <div class="flex flex-wrap gap-3">${radios(`video-formato-${n}`, [
            ["horizontal", "Horizontal", '<span aria-hidden="true" class="h-3 w-5 rounded-[2px] border-2 border-current"></span>'],
            ["vertical", "Vertical", '<span aria-hidden="true" class="h-5 w-3 rounded-[2px] border-2 border-current"></span>'],
          ], vertical ? "vertical" : "horizontal")}</div>
          <p class="${HINT}">Los reels y los videos de TikTok son verticales.</p>
        </fieldset>`;

/** Portada del video `n`: quitarla, cambiarla o usar la de su plataforma; `miniatura` la muestra junto a los botones. */
export function campoPortada(n: number, portada: Photo | null, miniatura = true) {
  const quitar = `<button type="button" data-video-cover-remove="${n}" class="${ICON_DANGER}" aria-label="Quitar la portada del video ${n + 1}">${iconSvg("trash", 18)}</button>`;
  const cover = portada
    ? `${miniatura ? `<img src="${esc(thumb(portada))}" alt="" class="h-20 w-14 rounded-control object-cover" />` : ""}${quitar}${upload(`video-portada-${n}`, "Cambiar portada")}`
    : upload(`video-portada-${n}`, "Subir portada");
  return `<div><span class="${LABEL}">Portada</span><div class="${FILA_BOTONES}">${cover}<button type="button" data-video-cover-auto="${n}" class="${GHOST}" hidden>${iconSvg("image", 17)} Usar la imagen del video</button></div>
          <p class="${HINT}">Es la imagen que se ve antes de reproducir. Al pegar el enlace se usa la del video si su plataforma la ofrece; si no, una imagen de la campaña. Puedes subir otra: 1080 × 1920 px si el video es vertical y 1280 × 720 px si es horizontal.</p></div>`;
}

/** Marca el video `i` con el aviso de la plataforma que no deja mostrarlo; cambiar el enlace lo quita. */
export function marcarNoInsertable(root: ParentNode, i: number, mensaje: string) {
  const input = root.querySelector<HTMLInputElement>(`#video-enlace-${i}`), status = root.querySelector<HTMLElement>(`#video-detectado-${i}`);
  if (!status) return;
  status.textContent = mensaje;
  status.classList.add("text-error");
  input?.removeAttribute("data-valido");
  input?.setAttribute("aria-invalid", "true");
}

/** Si `error` es el rechazo de la API a un video que su plataforma no deja mostrar («Video 2: …»), su posición en `enlaces` y el aviso. */
export function videoRechazado(error: unknown, enlaces: string[]) {
  const [, numero, texto] = (error instanceof Error && error.message.match(/^Video (\d+): (.+)$/)) || [];
  const i = Number(numero) - 1;
  const source = texto && enlaces[i] ? videoSource(enlaces[i]) : null;
  return source && (["bloqueado", "no-existe"] as const).some((m) => avisoNoInsertable(source.provider, m) === texto) ? { i, texto } : null;
}

/** Muestra si el enlace del video `n` es válido o por qué no, y devuelve su plataforma; con `ajustar`, marca su formato. */
export function comprobarEnlace(root: ParentNode, n: number | "nuevo", ajustar: boolean) {
  const input = root.querySelector<HTMLInputElement>(`#video-enlace-${n}`)!;
  const status = root.querySelector<HTMLElement>(`#video-detectado-${n}`)!;
  const text = input.value.trim();
  const source = text ? videoSource(text) : null;
  if (source) status.innerHTML = `<span aria-hidden="true" class="grid size-7 shrink-0 place-items-center rounded-full bg-success text-white">${iconSvg("check", 17)}</span><span class="text-success">Enlace válido · ${PROVIDERS[source.provider]}</span>`;
  else status.textContent = text ? videoLinkProblem(text) : "";
  status.classList.toggle("text-error", Boolean(text) && !source);
  input.setAttribute("aria-invalid", String(Boolean(text) && !source));
  input.toggleAttribute("data-valido", Boolean(source));
  const nota = root.querySelector<HTMLElement>(`#video-nota-${n}`);
  if (nota) nota.hidden = source?.provider !== "tiktok";
  if (source && ajustar) root.querySelectorAll<HTMLInputElement>(`[name="video-formato-${n}"]`).forEach((r) => { r.checked = (r.value === "vertical") === source.vertical; });
  const auto = root.querySelector<HTMLElement>(`[data-video-cover-auto="${n}"]`);
  if (auto) auto.hidden = !source || source.provider === "mp4";
  return source;
}
