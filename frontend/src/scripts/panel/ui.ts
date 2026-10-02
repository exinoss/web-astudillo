import { showStatus } from "../../lib/auth/page";
import type { Profile } from "../../lib/data/auth-repository";
import { adminApi, type Draft } from "../../lib/data/http/admin-api";
import { esc } from "../../lib/html";
import { iconSvg } from "../../lib/iconos";

export { esc, iconSvg };

export const INPUT =
  "min-h-12 w-full rounded-[3px] border border-[#acbacb] bg-base-100 px-3.5 py-3 text-sm text-primary focus-visible:outline-secondary aria-invalid:border-2 aria-invalid:border-error";
export const LABEL = "mb-[7px] block text-[0.82rem] font-bold";
export const HINT = "m-0 mt-1.5 text-[0.72rem] leading-normal text-[#50617d]";
export const GHOST =
  "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-[3px] border border-base-300 bg-transparent px-[18px] text-[0.82rem] font-bold text-primary hover:bg-base-200";
export const DANGER =
  "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-[3px] border border-error/40 bg-transparent px-[18px] text-[0.82rem] font-bold text-error hover:bg-[#fff2f2]";
export const ICON_BUTTON =
  "grid size-11 shrink-0 place-items-center rounded-[3px] text-primary hover:bg-base-200 disabled:opacity-40 disabled:hover:bg-transparent";
export const PILL = "inline-flex items-center rounded-full px-3 py-1 text-[0.66rem] font-bold tracking-[0.08em] whitespace-nowrap uppercase";
export const DRAFT_PILL = `${PILL} border border-secondary/60 bg-[#fff4e5] text-[#8a4b00]`;

/** Tarjeta blanca con borde superior amarillo, como las de cuenta. */
export const card = (title: string, inner: string, extra = "") => `
  <section class="rounded-[3px] border border-base-300 border-t-[5px] border-t-accent bg-base-100 px-8 py-7 [box-shadow:0_10px_35px_#0631760d] max-tablet:px-4 max-tablet:py-5 ${extra}">
    ${title ? `<h2 class="m-0 mb-4 text-[2rem] leading-[1.05] max-tablet:text-[1.8rem]">${esc(title)}</h2>` : ""}
    ${inner}
  </section>`;

/** Campo de texto con etiqueta; `area` lo convierte en textarea. Todos los valores se escapan. */
export function field(o: { id: string; label: string; value: string; max: number; area?: boolean; hint?: string; name?: string }) {
  const common = `id="${esc(o.id)}" name="${esc(o.name ?? o.id)}" maxlength="${o.max}" class="${INPUT}${o.area ? " min-h-[110px] resize-y" : ""}"`;
  return `<div>
    <label for="${esc(o.id)}" class="${LABEL}">${esc(o.label)}</label>
    ${o.area ? `<textarea ${common} rows="4">${esc(o.value)}</textarea>` : `<input ${common} value="${esc(o.value)}" />`}
    ${o.hint ? `<p class="${HINT}">${esc(o.hint)}</p>` : ""}
  </div>`;
}

export const value = (root: ParentNode, selector: string) =>
  (root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? "").trim();


export const state = {
  profile: null as Profile | null,
  draft: null as Draft | null,
  pending: [] as { tipo: string; descripcion: string }[],
};

const status = document.querySelector<HTMLElement>("#panel-estado")!;
const publishButton = document.querySelector<HTMLButtonElement>("#panel-publicar")!;

/** Mensaje accesible bajo las pestañas; los errores de la API llegan ya en lenguaje genérico. */
export function notify(message: string, error = false) {
  showStatus(status, message, error);
  status.scrollIntoView({ block: "nearest" });
}

export const can = (permission: string) => state.profile?.permisos.includes(permission) ?? false;

export async function reloadDraft() {
  state.draft = await adminApi.draft();
}

/** Actualiza lo pendiente de publicar y el contador del botón de la cabecera. */
export async function reloadPending() {
  if (!can("contenido.publicar")) return;
  state.pending = (await adminApi.pending()).cambios;
  syncPublishButton();
}

export function syncPublishButton() {
  publishButton.querySelector("span")!.textContent = state.pending.length
    ? `Publicar cambios (${state.pending.length})` : "Sin cambios por publicar";
  publishButton.disabled = !state.pending.length;
}

export const isPending = (tipo: string, descripcion: string) =>
  state.pending.some((c) => c.tipo === tipo && c.descripcion === descripcion);

/** Ejecuta una acción con el botón bloqueado y el error convertido en aviso. */
export async function busy(button: HTMLButtonElement | null, action: () => Promise<void>) {
  if (button) button.disabled = true;
  try {
    await action();
  } catch (error) {
    notify(error instanceof Error ? error.message : "No se pudo completar la acción.", true);
  } finally {
    if (button) button.disabled = false;
  }
}
