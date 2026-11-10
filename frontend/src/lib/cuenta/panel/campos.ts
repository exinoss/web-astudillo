import { ACEPTA_FOTOS } from "../../../../../backend/src/contracts/media";
import { uploadedUrl } from "../../comun/fotos";
import { MENSAJE_CAMPO } from "../../comun/campos";
import { esc } from "../../comun/html";
import { iconSvg } from "../../comun/iconos";
import type { Photo } from "../../data/http/admin-api";

export const LABEL = "mb-[7px] block text-[0.82rem] font-bold";
export const HINT = "m-0 mt-1.5 text-[0.72rem] leading-normal text-muted";
export const GHOST =
  "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-control border border-base-300 bg-transparent px-[18px] text-[0.82rem] font-bold text-primary hover:bg-base-200";
export const ICON_BUTTON =
  "grid size-11 shrink-0 place-items-center rounded-control text-primary hover:bg-base-200 disabled:opacity-40 disabled:hover:bg-transparent";
export const BOTON = "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-control px-[18px] text-[0.82rem] font-bold whitespace-nowrap";
export const PRINCIPAL = `${BOTON} bg-primary text-primary-content disabled:bg-disabled disabled:text-muted`;
// El color del borde va aparte (`PESTANA_NORMAL`) para que una variante lo cambie sin competir con él.
export const PESTANA = "min-h-11 rounded-control border bg-base-100 px-4 text-[0.82rem] font-bold aria-pressed:text-white";
export const PESTANA_NORMAL = "border-base-300 aria-pressed:border-primary aria-pressed:bg-primary";
export const GRUPO = "min-w-0 rounded-control border border-base-300 p-4";
export const LEYENDA = "px-1 text-[0.82rem] font-bold";

const UPLOAD = `${GHOST} relative cursor-pointer focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-neutral`;

export const thumb = (foto: Photo) => uploadedUrl(foto, foto.anchos[0]);
export const upload = (id: string, label: string, multiple = false) =>
  `<label class="${UPLOAD}">${iconSvg("upload", 17)} ${esc(label)}<input id="${id}" type="file" accept="${ACEPTA_FOTOS}" ${multiple ? "multiple" : ""} class="sr-only" /></label>`;
/** Botones para subir y bajar el elemento `i` de una lista; los `fijos` primeros no se mueven. */
export const subirBajar = (kind: string, i: number, total: number, name: string, fijos = 0) => `
  <button type="button" class="${ICON_BUTTON}" data-move="${kind}" data-index="${i}" data-step="-1" aria-label="Subir ${name}" ${i <= fijos ? "disabled" : ""}>${iconSvg("up", 18)}</button>
  <button type="button" class="${ICON_BUTTON}" data-move="${kind}" data-index="${i}" data-step="1" aria-label="Bajar ${name}" ${i === total - 1 || i < fijos ? "disabled" : ""}>${iconSvg("chevron", 18)}</button>`;
/** Con `minimo`, quitar se desactiva si la lista no puede acortarse; los `fijos` primeros no se mueven ni se quitan. */
export const moveButtons = (kind: string, i: number, total: number, name: string, minimo = 0, fijos = 0) => `${subirBajar(kind, i, total, name, fijos)}
  ${i < fijos ? "" : `<button type="button" class="${ICON_BUTTON} text-error" data-remove="${kind}" data-index="${i}" aria-label="Quitar ${name}" ${total <= minimo ? "disabled" : ""}>${iconSvg("trash", 18)}</button>`}`;

/** Campo de texto con etiqueta; `area` lo convierte en textarea. Todos los valores se escapan. */
export function field(o: { id: string; label: string; value: string; max: number; area?: boolean; hint?: string; name?: string; required?: boolean }) {
  const common = `id="${esc(o.id)}" name="${esc(o.name ?? o.id)}" maxlength="${o.max}" class="campo${o.area ? " min-h-[110px] resize-y" : ""}"${o.required ? " required" : ""}`;
  return `<div>
    <label for="${esc(o.id)}" class="${LABEL}">${esc(o.label)}</label>
    ${o.area ? `<textarea ${common} rows="4">${esc(o.value)}</textarea>` : `<input ${common} value="${esc(o.value)}" />`}
    ${o.hint ? `<p class="${HINT}">${esc(o.hint)}</p>` : ""}
  </div>`;
}

/** Lista desplegable con etiqueta; una opción `disabled` se ve pero no se elige, y `error` marca el campo. Todo se escapa. */
export function selectField(o: { id: string; label: string; value: string; options: { value: string; label: string; disabled?: boolean }[]; placeholder?: string; error?: string }) {
  return `<div>
    <label for="${esc(o.id)}" class="${LABEL}${o.error ? " text-error" : ""}">${esc(o.label)}</label>
    <select id="${esc(o.id)}" name="${esc(o.id)}" class="campo" ${o.error ? `aria-invalid="true" aria-describedby="${esc(o.id)}-error"` : ""}>
      ${o.placeholder ? `<option value="" disabled ${o.value ? "" : "selected"}>${esc(o.placeholder)}</option>` : ""}
      ${o.options.map((x) => `<option value="${esc(x.value)}" ${x.value === o.value ? "selected" : ""} ${x.disabled ? "disabled" : ""}>${esc(x.label)}</option>`).join("")}
    </select>
    ${o.error ? `<p id="${esc(o.id)}-error" class="${MENSAJE_CAMPO}">${esc(o.error)}</p>` : ""}
  </div>`;
}

/** Fila «etiqueta + lista» que elige qué elemento se edita; `opciones` llega ya escapado. */
export const selector = (id: string, label: string, opciones: string) => `
    <div class="mb-5 flex items-center gap-3.5 max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-1.5">
      <label for="${id}" class="text-[0.82rem] font-bold">${label}</label>
      <select id="${id}" class="campo min-w-[320px] max-tablet:min-w-0">
        ${opciones}
      </select>
    </div>`;

/** Lista desplegable de una barra de filtros; `ancho` es su ancho mínimo en escritorio. */
export const filtro = (id: string, label: string, options: [string, string][], current: string, ancho: string) => `
    <div class="flex ${ancho} flex-col gap-1.5 max-tablet:min-w-0">
      <label for="${id}" class="text-[0.76rem] font-bold">${label}</label>
      <select id="${id}" class="campo">
        ${options.map(([v, t]) => `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(t)}</option>`).join("")}
      </select>
    </div>`;

/** Enlaza subir, bajar y quitar: `cambio` aplica la mutación (con `movido` si fue un movimiento) y vuelve a dibujar. */
export function enlazarLista(raiz: ParentNode, lista: (tipo: string) => unknown[], cambio: (mutar: () => void, movido?: { indice: number; paso: string }) => void) {
  raiz.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((b) => b.addEventListener("click", () => {
    const i = Number(b.dataset.index), j = i + Number(b.dataset.step);
    cambio(() => {
      const l = lista(b.dataset.move!);
      [l[i], l[j]] = [l[j], l[i]];
    }, { indice: j, paso: b.dataset.step! });
  }));
  raiz.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((b) => b.addEventListener("click", () =>
    cambio(() => void lista(b.dataset.remove!).splice(Number(b.dataset.index), 1))));
}
