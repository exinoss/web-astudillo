import { ACEPTA_FOTOS } from "../../../../../backend/src/contracts/media";
import { uploadedUrl } from "../../comun/fotos";
import { esc } from "../../comun/html";
import { iconSvg } from "../../comun/iconos";
import type { Photo } from "../../data/http/admin-api";

export const INPUT =
  "min-h-12 w-full rounded-[3px] border border-field-border bg-base-100 px-3.5 py-3 text-sm text-primary placeholder:text-field-placeholder placeholder:opacity-100 focus-visible:outline-neutral aria-invalid:border-2 aria-invalid:border-error";
export const LABEL = "mb-[7px] block text-[0.82rem] font-bold";
export const HINT = "m-0 mt-1.5 text-[0.72rem] leading-normal text-[#50617d]";
export const GHOST =
  "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-[3px] border border-base-300 bg-transparent px-[18px] text-[0.82rem] font-bold text-primary hover:bg-base-200";
export const ICON_BUTTON =
  "grid size-11 shrink-0 place-items-center rounded-[3px] text-primary hover:bg-base-200 disabled:opacity-40 disabled:hover:bg-transparent";

const UPLOAD = `${GHOST} cursor-pointer focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-neutral`;

export const thumb = (foto: Photo) => uploadedUrl(foto, foto.anchos[0]);
export const upload = (id: string, label: string, multiple = false) =>
  `<label class="${UPLOAD}">${iconSvg("upload", 17)} ${esc(label)}<input id="${id}" type="file" accept="${ACEPTA_FOTOS}" ${multiple ? "multiple" : ""} class="sr-only" /></label>`;
/** Con `minimo`, el botón de quitar se desactiva cuando la lista no puede quedar más corta. */
export const moveButtons = (kind: string, i: number, total: number, name: string, minimo = 0) => `
  <button type="button" class="${ICON_BUTTON}" data-move="${kind}" data-index="${i}" data-step="-1" aria-label="Subir ${name}" ${i === 0 ? "disabled" : ""}>${iconSvg("up", 18)}</button>
  <button type="button" class="${ICON_BUTTON}" data-move="${kind}" data-index="${i}" data-step="1" aria-label="Bajar ${name}" ${i === total - 1 ? "disabled" : ""}>${iconSvg("chevron", 18)}</button>
  <button type="button" class="${ICON_BUTTON} text-error" data-remove="${kind}" data-index="${i}" aria-label="Quitar ${name}" ${total <= minimo ? "disabled" : ""}>${iconSvg("trash", 18)}</button>`;

/** Campo de texto con etiqueta; `area` lo convierte en textarea. Todos los valores se escapan. */
export function field(o: { id: string; label: string; value: string; max: number; area?: boolean; hint?: string; name?: string }) {
  const common = `id="${esc(o.id)}" name="${esc(o.name ?? o.id)}" maxlength="${o.max}" class="${INPUT}${o.area ? " min-h-[110px] resize-y" : ""}"`;
  return `<div>
    <label for="${esc(o.id)}" class="${LABEL}">${esc(o.label)}</label>
    ${o.area ? `<textarea ${common} rows="4">${esc(o.value)}</textarea>` : `<input ${common} value="${esc(o.value)}" />`}
    ${o.hint ? `<p class="${HINT}">${esc(o.hint)}</p>` : ""}
  </div>`;
}
