import { vigilarCambios } from "../../../../lib/comun/cambios";
import {
  adminApi, type ParticipationKind, type ParticipationPage, type ParticipationState, type ParticipationVisibility, type ReviewedAlert, type ReviewedSuggestion,
} from "../../../../lib/data/http/admin-api";
import { ApiError } from "../../../../lib/data/http/api-client";
import { BOLA, INTERRUPTOR, PISTA } from "../../../../lib/cuenta/panel/campos";
import { confirmarIdentidad } from "../confirmacion";
import { renderPagination } from "../../../../lib/cuenta/panel/paginacion";
import { PESTANA_SUBRAYADA } from "../../../../lib/comun/pestanas";
import { ESTADOS, TIPOS_ALERTA } from "../../../../lib/ciudadania/participacion/tipos";
import { busy, can, card, cargar, confirmarCambio, esc, fechaHora, ICON_DANGER, iconSvg, state } from "../ui";
import { ampliarAlPulsar } from "../../../../lib/comun/visor-fotos";

const view = { tipo: "alertas" as ParticipationKind, estado: "" as ParticipationState | "", pagina: 1 };
// La sección es fija aunque su contenido se repinte: el clic se escucha una sola vez.
ampliarAlPulsar(document.querySelector<HTMLElement>("#seccion-participacion")!, "visor-alerta-panel", "Foto de la alerta");
const STATES = Object.keys(ESTADOS) as ParticipationState[];
const CHIP = "min-h-11 rounded-full border border-base-300 bg-base-100 px-3.5 text-[0.78rem] font-bold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-content";

/** Nombre del tema de una sugerencia. */
const topicName = (slug: string) => slug === "otro" ? "Otra idea" : state.draft!.propuestas.find((p) => p.slug === slug)?.nombre ?? slug;

/** Selector de estado con «Guardar» y la papelera; quien solo consulta ve la píldora del estado. */
const stateControl = (id: number, current: ParticipationState, que: string) => can("participacion.gestionar") ? `
  <span class="flex flex-wrap items-center gap-2" data-estado-de="${id}" data-actual="${current}">
    <label class="sr-only" for="estado-${id}">Estado</label>
    <select id="estado-${id}" class="campo px-3">
      ${STATES.map((s) => `<option value="${s}" ${s === current ? "selected" : ""}>${ESTADOS[s].nombre}</option>`).join("")}
    </select>
    <button type="button" class="button min-h-11 px-4 py-0" data-guardar-estado>Guardar</button>
    <button type="button" class="${ICON_DANGER}" data-borrar="${id}" aria-label="Borrar ${que}" title="Borrar ${que}">${iconSvg("trash", 18)}</button>
  </span>` : `<span class="pildora ${ESTADOS[current].clases}">${ESTADOS[current].nombre}</span>`;

/** Clases de la pista del interruptor: gris apagada y azul encendida. */
const pista = (activo: boolean) => `${PISTA} ${activo ? "justify-end bg-primary" : "bg-base-300"}`;

/** Interruptor encendido/apagado de la visibilidad de una fila. */
const interruptor = (campo: "publica" | "nombre", id: number, texto: string, activo: boolean) => `
  <button type="button" role="switch" aria-checked="${activo}" data-${campo}="${id}" class="${INTERRUPTOR} whitespace-nowrap">
    <span class="${pista(activo)}"><span class="${BOLA} bg-primary-content"></span></span>${texto}
  </button>`;

/** Enciende o apaga un interruptor ya pintado. */
function pintarInterruptor(boton: HTMLButtonElement, activo: boolean) {
  boton.setAttribute("aria-checked", String(activo));
  boton.firstElementChild!.className = pista(activo);
}

/** «Publicada en el sitio» (solo alertas) y «Mostrar el nombre», bajo el texto de la fila. */
const visibilityControls = (id: number, v: ParticipationVisibility) => can("participacion.gestionar") ? `
  <div class="mt-1 flex flex-wrap gap-x-5">
    ${v.publica === undefined ? "" : interruptor("publica", id, "Publicada en el sitio", v.publica)}${interruptor("nombre", id, "Mostrar el nombre", !v.anonima)}
  </div>` : "";

/** Fila de una alerta en el panel. */
function alertItem(a: ReviewedAlert) {
  const tipo = TIPOS_ALERTA.find((t) => t.valor === a.tipo)!;
  const thumb = a.foto
    ? `<button type="button" class="block cursor-zoom-in rounded-card" data-ampliar="${esc(a.foto.grande)}" data-pie="${esc(`${a.sector} · ${a.descripcion}`)}" aria-label="Ampliar la foto de la alerta"><img class="size-[72px] rounded-card object-cover max-tablet:size-14" src="${esc(a.foto.miniatura)}" alt="Foto enviada con la alerta" loading="lazy" /></button>`
    : `<span class="grid size-[72px] place-items-center rounded-card bg-neutral-soft text-neutral max-tablet:size-14">${iconSvg(tipo.icono, 28)}</span>`;
  return `<li class="grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-3.5 border-t border-t-base-300 py-4 first:border-t-0 max-tablet:grid-cols-[56px_minmax(0,1fr)]">
    ${thumb}
    <div class="min-w-0">
      <strong class="flex items-center gap-1.5 text-[0.92rem]">${iconSvg(tipo.icono, 18)} ${esc(tipo.nombre)} · ${esc(a.sector)}</strong>
      <p class="mt-1 mb-0 text-[0.84rem] leading-normal wrap-anywhere">${esc(a.descripcion)}</p>
      <small class="text-[0.72rem] text-muted">${esc(a.autor ?? a.correo)} · ${fechaHora.format(new Date(a.creadoEn))}${a.referencia ? ` · Ref.: ${esc(a.referencia)}` : ""}</small>
      ${visibilityControls(a.id, { publica: a.publica, anonima: a.anonima })}
    </div>
    <div class="max-tablet:col-span-2">${stateControl(a.id, a.estado, "alerta")}</div>
  </li>`;
}

/** Fila de una sugerencia en el panel. */
function suggestionItem(s: ReviewedSuggestion) {
  return `<li class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3.5 border-t border-t-base-300 py-4 first:border-t-0 max-tablet:grid-cols-1">
    <div class="min-w-0">
      <strong class="text-[0.92rem]">${esc(topicName(s.tema))}</strong>
      <p class="mt-1 mb-0 text-[0.84rem] leading-normal whitespace-pre-line wrap-anywhere">${esc(s.mensaje)}</p>
      <small class="text-[0.72rem] text-muted">${esc(s.autor ?? s.correo)} · ${fechaHora.format(new Date(s.creadoEn))}</small>
      ${visibilityControls(s.id, { anonima: s.anonima })}
    </div>
    <div>${stateControl(s.id, s.estado, "sugerencia")}</div>
  </li>`;
}

/** Deja elegidos el tipo y el estado de un aviso de la campana (se ignora un estado que no existe). */
export function filtrarParticipacion(tipo: ParticipationKind, estado: string) {
  if (STATES.includes(estado as ParticipationState)) Object.assign(view, { tipo, estado, pagina: 1 });
}

/** Pinta la lista de alertas o sugerencias con sus filtros. */
export async function renderParticipation(section: HTMLElement) {
  const data = await adminApi.participation<ReviewedAlert | ReviewedSuggestion>(view.tipo, view.pagina, view.estado || undefined);
  const counts = data.conteo[view.tipo];
  const all = STATES.reduce((sum, s) => sum + counts[s], 0);
  const total = (kind: ParticipationKind) => STATES.reduce((sum, s) => sum + data.conteo[kind][s], 0);
  const list = data.items.length
    ? `<ul class="m-0 list-none p-0">${data.items.map((item) => view.tipo === "alertas" ? alertItem(item as ReviewedAlert) : suggestionItem(item as ReviewedSuggestion)).join("")}</ul>`
    : `<p class="m-0 py-4 text-[0.86rem]">No hay ${view.tipo} en este estado.</p>`;
  section.innerHTML = card("", `
    <div class="flex gap-7 whitespace-nowrap" role="tablist" aria-label="Tipo">
      ${(["alertas", "sugerencias"] as const).map((k) => `<button type="button" role="tab" class="${PESTANA_SUBRAYADA}" data-tipo="${k}" aria-selected="${k === view.tipo}">${k === "alertas" ? "Alertas" : "Sugerencias"} (${total(k)})</button>`).join("")}
    </div>
    <div class="mt-3 mb-1.5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
      <button type="button" class="${CHIP}" data-filtro="" aria-pressed="${!view.estado}">Todas (${all})</button>
      ${STATES.map((s) => `<button type="button" class="${CHIP}" data-filtro="${s}" aria-pressed="${view.estado === s}">${ESTADOS[s].nombre} (${counts[s]})</button>`).join("")}
    </div>
    ${list}
    <div id="participacion-paginas"></div>`);
  bind(section, data);
}

/** Conecta los filtros, la paginación y los controles de la lista. */
function bind(section: HTMLElement, data: ParticipationPage<unknown>) {
  const reload = () => cargar(renderParticipation(section));
  section.querySelectorAll<HTMLButtonElement>("[data-tipo]").forEach((b) => b.addEventListener("click", () => {
    Object.assign(view, { tipo: b.dataset.tipo, estado: "", pagina: 1 });
    reload();
  }));
  section.querySelectorAll<HTMLButtonElement>("[data-filtro]").forEach((b) => b.addEventListener("click", () => {
    Object.assign(view, { estado: b.dataset.filtro, pagina: 1 });
    reload();
  }));
  section.querySelectorAll<HTMLElement>("[data-estado-de]").forEach((control) => {
    const select = control.querySelector("select")!;
    const button = control.querySelector<HTMLButtonElement>("[data-guardar-estado]")!;
    const before = control.dataset.actual as ParticipationState;
    vigilarCambios(control, button, before, () => select.value);
    // Se envía el estado que se veía: si otra persona lo cambió mientras tanto, la API responde 409.
    button.addEventListener("click", () => void busy(button, async () => {
      await adminApi.changeParticipationState(view.tipo, Number(control.dataset.estadoDe), select.value as ParticipationState, before);
      await renderParticipation(section);
      confirmarCambio({ tipo: "exito", titulo: `Estado actualizado a «${ESTADOS[select.value as ParticipationState].nombre}»` });
    }));
  });
  const items = data.items as (ReviewedAlert | ReviewedSuggestion)[];
  const visibilidad = (id: number): ParticipationVisibility => {
    const item = items.find((i) => i.id === id)!;
    return "publica" in item ? { publica: item.publica, anonima: item.anonima } : { anonima: item.anonima };
  };
  // Se envía la visibilidad que se veía: si otra persona la cambió mientras tanto, la API responde 409.
  const cambiar = (button: HTMLButtonElement, id: number, cambio: Partial<ParticipationVisibility>, aviso: string) =>
    void busy(button, async () => {
      const antes = visibilidad(id);
      const activo = button.getAttribute("aria-checked") !== "true";
      pintarInterruptor(button, activo);
      try {
        await adminApi.changeParticipationVisibility(view.tipo, id, { ...antes, ...cambio }, antes);
      } catch (error) {
        pintarInterruptor(button, !activo);
        if (error instanceof ApiError && error.status === 409) cargar(renderParticipation(section));
        throw error;
      }
      Object.assign(items.find((i) => i.id === id)!, cambio);
      confirmarCambio({ tipo: "exito", titulo: aviso });
    });
  section.querySelectorAll<HTMLButtonElement>("[data-publica]").forEach((b) => b.addEventListener("click", () => {
    const publica = b.getAttribute("aria-checked") !== "true";
    cambiar(b, Number(b.dataset.publica), { publica }, publica ? "Alerta publicada en el sitio" : "Alerta retirada del sitio");
  }));
  section.querySelectorAll<HTMLButtonElement>("[data-nombre]").forEach((b) => b.addEventListener("click", () => {
    const anonima = b.getAttribute("aria-checked") === "true";
    cambiar(b, Number(b.dataset.nombre), { anonima }, anonima ? "Se publica sin el nombre" : "Se publica con el nombre");
  }));
  section.querySelectorAll<HTMLButtonElement>("[data-borrar]").forEach((b) => b.addEventListener("click", () => void busy(b, async () => {
    const id = Number(b.dataset.borrar);
    const item = items.find((i) => i.id === id)!;
    const que = view.tipo === "alertas" ? "la alerta" : "la sugerencia";
    const hecho = await confirmarIdentidad({
      perfil: state.profile!,
      resumen: `Vas a borrar ${que} de <strong>${esc(item.autor ?? item.correo)}</strong>. Dejará de verse en el sitio y en el panel.`,
      boton: "Borrar", peligro: true,
      enviar: (confirmacion) => adminApi.deleteParticipation(view.tipo, id, confirmacion),
    });
    if (!hecho) return;
    await renderParticipation(section);
    confirmarCambio({ tipo: "exito", titulo: view.tipo === "alertas" ? "Alerta borrada" : "Sugerencia borrada" });
  })));
  const filtered = view.estado ? data.conteo[view.tipo][view.estado] : STATES.reduce((sum, s) => sum + data.conteo[view.tipo][s], 0);
  renderPagination(section.querySelector("#participacion-paginas")!, { total: filtered, pagina: data.pagina, porPagina: data.porPagina }, (p) => {
    view.pagina = p;
    reload();
  });
}
