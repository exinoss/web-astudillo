import { adminApi, type Publication } from "../../lib/data/http/admin-api";
import { renderPagination } from "../../lib/paginacion";
import { busy, card, esc, iconSvg, notify, PILL, reloadPending, state, syncPublishButton } from "./ui";

const STATES: Record<Publication["estado"], [string, string]> = {
  en_cola: ["En cola", "bg-[#fff4e5] text-[#8a4b00]"],
  publicando: ["Publicando…", "bg-[#fff4e5] text-[#8a4b00]"],
  publicada: ["Publicada", "bg-[#e8f5ec] text-[#1d6b37]"],
  fallida: ["Falló", "bg-[#fff2f2] text-error"],
};
const date = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" });
let page = 1;
let poll = 0;

const duration = (p: Publication) => p.iniciadoEn && p.terminadoEn
  ? `${Math.max(1, Math.round((Date.parse(p.terminadoEn) - Date.parse(p.iniciadoEn)) / 1000))} s` : "—";

export async function renderPublications(section: HTMLElement) {
  clearTimeout(poll);
  await reloadPending();
  const changes = state.pending;
  const pending = card("Cambios pendientes", `
    <p class="m-0 mb-2 text-[0.85rem] leading-normal">Se publican juntos. Mientras tanto, el sitio público sigue mostrando la última versión.</p>
    ${changes.length ? changes.map((c) => `
      <div class="flex items-start gap-3.5 border-t border-t-base-300 py-3.5 first:border-t-0 max-tablet:flex-col max-tablet:gap-1.5">
        <span class="${PILL} border border-base-300">${esc(c.tipo)}</span><strong class="text-[0.88rem]">${esc(c.descripcion)}</strong>
      </div>`).join("") : `<p class="m-0 py-3 text-[0.86rem]">No hay cambios por publicar.</p>`}
    <button type="button" id="publicar-ahora" class="button mt-4 w-full" ${changes.length ? "" : "disabled"}>${iconSvg("upload", 18)} Publicar ${changes.length || ""} ${changes.length === 1 ? "cambio" : "cambios"}</button>
    <p class="m-0 mt-2.5 text-center text-[0.74rem] text-[#50617d]">Tarda cerca de un minuto.</p>`);
  section.innerHTML = `
    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-start gap-6 max-tablet:grid-cols-1">
      ${pending}
      ${card("Historial", `<div id="historial"></div><div id="historial-paginas"></div>`)}
    </div>`;
  section.querySelector<HTMLButtonElement>("#publicar-ahora")!.addEventListener("click", (e) => publish(e.currentTarget as HTMLButtonElement, section));
  await drawHistory(section);
}

/** Publica y vuelve a pintar; lo usa también el botón de la cabecera. */
export async function publish(button: HTMLButtonElement | null, section: HTMLElement) {
  await busy(button, async () => {
    await adminApi.publish();
    notify("Publicación en cola. El sitio se actualizará en cerca de un minuto.");
    page = 1;
    await renderPublications(section);
  });
  // `busy` reactiva el botón al terminar; se vuelve a ajustar a lo que queda pendiente.
  syncPublishButton();
}

async function drawHistory(section: HTMLElement) {
  const data = await adminApi.publications(page);
  const box = section.querySelector<HTMLElement>("#historial");
  if (!box) return;
  box.innerHTML = data.publicaciones.length ? data.publicaciones.map((p) => {
    const [name, classes] = STATES[p.estado];
    return `
      <div class="grid grid-cols-[60px_150px_1fr_1fr_80px] items-center gap-3 border-t border-t-base-300 py-3 text-[0.85rem] first:border-t-0 max-tablet:grid-cols-[auto_1fr] max-tablet:gap-x-3 max-tablet:gap-y-1">
        <strong>#${esc(p.id)}</strong>
        <span class="max-tablet:justify-self-end"><span class="${PILL} ${classes}">${name}</span></span>
        <span class="max-tablet:col-span-2 max-tablet:text-[0.76rem] max-tablet:text-[#50617d]">${esc(date.format(new Date(p.creadoEn)))}</span>
        <span class="max-tablet:col-span-2 max-tablet:text-[0.76rem] max-tablet:text-[#50617d]">${esc(p.autor ?? "—")}</span>
        <span class="max-tablet:col-span-2 max-tablet:text-[0.76rem] max-tablet:text-[#50617d]">${duration(p)}</span>
        ${p.detalle ? `<span class="col-span-5 text-[0.78rem] text-error max-tablet:col-span-2">${esc(p.detalle)}</span>` : ""}
      </div>`;
  }).join("") : `<p class="m-0 text-[0.86rem]">Todavía no se ha publicado nada desde el panel.</p>`;
  renderPagination(section.querySelector("#historial-paginas")!, data, (p) => { page = p; void drawHistory(section); });
  // Mientras algo compila, se consulta de nuevo hasta que termine.
  if (data.publicaciones.some((p) => p.estado === "en_cola" || p.estado === "publicando"))
    poll = window.setTimeout(() => { if (!section.hidden) void renderPublications(section); }, 4000);
}
