import { mostrarCarga } from "../../../lib/comun/animaciones";
import { showStatus } from "../../../lib/cuenta/auth/page";
import type { Profile } from "../../../lib/data/auth-repository";
import { adminApi, type Draft } from "../../../lib/data/http/admin-api";
import { esc } from "../../../lib/comun/html";
import { iconSvg } from "../../../lib/comun/iconos";
import { bloquearMientras } from "../../../lib/cuenta/panel/cambios";
import { ACEPTA_FOTOS, FORMATOS_FOTO } from "../../../../../backend/src/contracts/media";
import { GHOST } from "../../../lib/cuenta/panel/campos";

export { ACEPTA_FOTOS, esc, FORMATOS_FOTO, iconSvg };
export { field, GHOST, HINT, ICON_BUTTON, INPUT, LABEL, moveButtons, thumb, upload } from "../../../lib/cuenta/panel/campos";

export const DANGER =
  "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-[3px] border border-error/40 bg-transparent px-[18px] text-[0.82rem] font-bold text-error hover:bg-[#fff2f2]";
export const PILL = "inline-flex items-center rounded-full px-3 py-1 text-[0.66rem] font-bold tracking-[0.08em] whitespace-nowrap uppercase";
export const DRAFT_PILL = `${PILL} border border-secondary/60 bg-[#fff4e5] text-[#8a4b00]`;

// Sin el permiso de publicar no se conoce lo pendiente: el botón queda siempre activo.
const nothingToPreview = () => can("contenido.publicar") && !state.pending.length;

/** El panel (index.ts) abre `ruta` en la pestaña de vista previa al pulsarlo. */
export const previewButton = (ruta: string) =>
  `<button type="button" class="${GHOST} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent" data-vista-previa="${esc(ruta)}" ${nothingToPreview() ? "disabled" : ""}>${iconSvg("eye", 18)} Vista previa del borrador</button>`;

/** Tarjeta blanca con borde superior amarillo, como las de cuenta. */
export const card = (title: string, inner: string, extra = "") => `
  <section class="rounded-[3px] border border-base-300 border-t-[5px] border-t-accent bg-base-100 px-8 py-7 [box-shadow:0_10px_35px_#0631760d] max-tablet:px-4 max-tablet:py-5 ${extra}">
    ${title ? `<h2 class="m-0 mb-4 text-[2rem] leading-[1.05] max-tablet:text-[1.8rem]">${esc(title)}</h2>` : ""}
    ${inner}
  </section>`;

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
  document.querySelectorAll<HTMLButtonElement>("[data-vista-previa]").forEach((b) => { b.disabled = nothingToPreview(); });
}

export const isPending = (tipo: string, descripcion: string) =>
  state.pending.some((c) => c.tipo === tipo && c.descripcion === descripcion);

/**
 * Ejecuta una acción con el botón bloqueado y el error convertido en aviso. Con `carga`, el loader cubre las
 * secciones (no la sección, que la acción vuelve a pintar); sin él se puede seguir escribiendo mientras se guarda.
 */
export async function busy(button: HTMLButtonElement | null, action: () => Promise<void>, carga?: string) {
  const run = async () => {
    const terminarCarga = carga ? mostrarCarga(document.querySelector<HTMLElement>("#panel-secciones")!, carga) : () => {};
    try {
      await action();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo completar la acción.", true);
    } finally {
      terminarCarga();
    }
  };
  await (button ? bloquearMientras(button, run) : run());
}
