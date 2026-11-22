import { vigilarCambios } from "../../../../lib/comun/cambios";
import { adminApi, type DraftWork, type DraftWorkEvidence, type Photo, type WorkEvidenceBody } from "../../../../lib/data/http/admin-api";
import { BARRA_AVANCE, RELLENO_AVANCE, STAGE_CLASSES, STAGE_NAMES, workProgress } from "../../../../lib/ciudadania/obras";
import { mountPlayer, videoSource } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/reproductor";
import { CIRCULO_PLAY } from "../../../../lib/acerca-de-nosotros/acerca-de-carlos/video";
import { campoFormato, comprobarEnlace, marcarNoInsertable, PROVIDERS, videoRechazado } from "../../../../lib/cuenta/panel/campos-video";
import { avisosActuales } from "../../../../lib/comun/avisos";
import { FILA_BOTONES } from "../../../../lib/cuenta/panel/campos";
import { formatoEnEnlace, VIDEO_URL_MAX } from "../../../../../../backend/src/contracts/video";
import { MAX_FOTOS_OBRA, MAX_VIDEOS_OBRA } from "../../../../../../backend/src/contracts/obras";
import { acciones, avisarVacios, avisoBorrador, busy, card, enlazarLista, esc, field, GHOST, guardarYRecargar, HINT, ICON_DANGER, iconSvg, isPending, LABEL, LARGOS, MAX_MB_FOTO, moveButtons, notify, selector, state, subirFotos, thumb, upload, value } from "../ui";

const MAX_MILESTONES = 20;
let selected = "";
let enlaceNuevo = "";
// Una copia por obra: cambiar de obra no pierde lo escrito.
const trabajo: Record<string, DraftWork> = {};

/** Nombre de la propuesta de una obra. */
const nameOf = (slug: string) => state.draft!.propuestas.find((p) => p.slug === slug)?.nombre ?? slug;

/** Una foto o un video tal como lo recibe la API. */
const cuerpo = (f: DraftWorkEvidence): WorkEvidenceBody => ("video" in f
  ? { video: { enlace: f.video.enlace, vertical: f.video.vertical, idPortada: f.video.portada?.idMedio ?? null }, pie: f.pie }
  : { idMedio: f.idMedio, pie: f.pie });

/** Lo que se guarda de una obra, para comparar la copia de trabajo con el borrador. */
const saved = (w: DraftWork) => ({ nota: w.nota, hitos: w.hitos, fotos: w.fotos.map(cuerpo) });

/** Abre la obra del aviso con que se entró al panel. */
export const abrirObra = (slug: string) => { selected = slug; };

/** Miniatura de una foto, o del video `i` como botón que lo reproduce (su portada con el círculo de reproducir). */
function miniatura(f: DraftWorkEvidence, i: number, nombre: string) {
  const caja = "aspect-[4/3] w-[104px] shrink-0 self-start rounded-control";
  if (!("video" in f)) return `<img src="${esc(thumb(f))}" alt="" class="${caja} object-cover" />`;
  return `<button type="button" data-ver-video="${i}" class="group relative ${caja} overflow-hidden bg-primary" aria-label="Ver el ${nombre.toLowerCase()}">
    ${f.video.portada ? `<img src="${esc(thumb(f.video.portada))}" alt="" class="absolute inset-0 h-full w-full object-cover object-[50%_25%]" />` : ""}
    <span aria-hidden="true" class="absolute inset-0 grid place-items-center">${CIRCULO_PLAY}</span>
  </button>`;
}

/** Cuadro para subir fotos o pegar el enlace de un video, y debajo la lista de lo añadido. */
function evidencias(fotos: DraftWorkEvidence[]) {
  const videos = fotos.filter((f) => "video" in f).length;
  let nf = 0, nv = 0;
  const filas = fotos.map((f, i) => {
    const source = "video" in f ? videoSource(f.video.enlace) : null;
    const nombre = "video" in f ? `Video ${++nv}` : `Foto ${++nf}`;
    return `
      <li class="flex gap-3 border-t border-t-base-300 py-3 first:border-t-0 max-mobile:flex-col">
        ${miniatura(f, i, nombre)}
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <div class="flex items-center justify-between gap-2"><strong class="text-[0.85rem]">${nombre}${source ? ` · ${PROVIDERS[source.provider]}` : ""}</strong>
            <button type="button" data-quitar-evidencia="${i}" class="${ICON_DANGER}" aria-label="Quitar ${nombre.toLowerCase()}">${iconSvg("trash", 18)}</button></div>
          ${"video" in f ? `<div data-reproductor="${i}" class="flex flex-col gap-2" hidden>
            <div data-video-stage class="relative w-full overflow-hidden rounded-[12px] bg-primary ${f.video.vertical ? "aspect-[9/16] max-w-[300px]" : "aspect-video"}"></div>
            <button type="button" data-cerrar-video="${i}" class="${GHOST} self-start">Cerrar</button>
          </div>` : ""}
          ${field({ id: `evidencia-pie-${i}`, label: "video" in f ? "Pie del video" : "Pie de foto", value: f.pie, max: LARGOS.obra.pie, required: true })}
          ${"video" in f && source ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer" class="truncate text-[0.75rem] text-muted underline underline-offset-4">${esc(source.url)}</a>
          <p id="video-detectado-${i}" role="status" class="m-0 text-[0.85rem] font-bold empty:hidden"></p>
          ${formatoEnEnlace(source) ? "" : campoFormato(i, f.video.vertical)}
          <div class="flex flex-wrap gap-2">${upload(`video-portada-${i}`, "Cambiar portada")}</div>` : ""}
        </div>
      </li>`;
  }).join("");
  return `<div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 rounded-card border-2 border-dashed border-field-border p-4">
      <span class="text-[0.82rem] font-bold">Añadir fotos o videos</span>
      <div class="${FILA_BOTONES}">${fotos.length - videos < MAX_FOTOS_OBRA ? upload("obra-fotos", "Subir fotos", true) : ""}<span class="text-[0.72rem] text-muted">Varias a la vez · hasta ${MAX_MB_FOTO} MB cada una · 1260 × 990 px o más</span></div>
      ${videos < MAX_VIDEOS_OBRA ? `<div>
        <label for="video-enlace-nuevo" class="${LABEL}">Enlace de un video</label>
        <div class="flex flex-col items-start gap-2.5">
          <input id="video-enlace-nuevo" name="video-enlace-nuevo" value="${esc(enlaceNuevo)}" maxlength="${VIDEO_URL_MAX}" class="campo" aria-describedby="video-detectado-nuevo" />
          <button type="button" data-anadir-video class="${GHOST}" disabled>${iconSvg("plus", 17)} Añadir video</button>
        </div>
        <p id="video-detectado-nuevo" role="status" class="m-0 mt-2 flex min-h-7 items-center gap-2 text-[0.85rem] font-bold"></p>
        <p class="${HINT}">De Facebook, TikTok, YouTube o Vimeo, tal como aparece en la barra del navegador. Hasta ${MAX_VIDEOS_OBRA} videos.</p>
      </div>` : `<p class="${HINT} m-0">Ya hay ${MAX_VIDEOS_OBRA} videos.</p>`}
    </div>
    ${filas ? `<ul class="m-0 flex list-none flex-col p-0">${filas}</ul>` : ""}
  </div>`;
}

/** Pasa a la copia de trabajo lo escrito en el formulario. */
function capture(form: HTMLElement) {
  const work = trabajo[selected];
  trabajo[selected] = {
    ...work,
    nota: value(form, "#obra-nota"),
    hitos: [...form.querySelectorAll<HTMLElement>(".obra-hito")].map((row) => ({
      nombre: value(row, '[name="hito"]'), completado: row.querySelector<HTMLInputElement>('[name="completado"]')!.checked,
    })),
    fotos: work.fotos.map((f, i) => {
      const pie = value(form, `#evidencia-pie-${i}`);
      if (!("video" in f)) return { ...f, pie };
      const formato = form.querySelector<HTMLInputElement>(`[name="video-formato-${i}"]:checked`);
      return { pie, video: { ...f.video, vertical: formato ? formato.value === "vertical" : f.video.vertical } };
    }),
  };
  enlaceNuevo = form.querySelector<HTMLInputElement>("#video-enlace-nuevo")?.value ?? enlaceNuevo;
}

/** Pinta el editor de la obra elegida. */
export function renderWorks(section: HTMLElement) {
  const works = state.draft!.obras;
  if (!works.some((w) => w.slug === selected)) selected = works[0]?.slug ?? "";
  const work = (trabajo[selected] ??= structuredClone(works.find((w) => w.slug === selected)!));
  const { percent, stage } = workProgress(work.hitos.map((h) => ({ done: h.completado })));
  const hitos = work.hitos.map((h, i) => `
    <div class="obra-hito flex items-center gap-2 border-t border-t-base-300 py-1.5 first:border-t-0">
      <input type="checkbox" name="completado" id="hito-completado-${i}" ${h.completado ? "checked" : ""} class="size-6 shrink-0 accent-neutral" aria-label="Hito ${i + 1} completado" />
      <div class="min-w-0 flex-1"><input id="hito-nombre-${i}" name="hito" value="${esc(h.nombre)}" maxlength="${LARGOS.obra.hito}" aria-label="Nombre del hito ${i + 1}" required class="campo" /></div>
      ${moveButtons("hito", i, work.hitos.length, `hito ${i + 1}`)}
    </div>`).join("");
  const form = card(nameOf(work.slug), `
    ${avisoBorrador(isPending("Obra", nameOf(work.slug)))}
    <div class="mb-6 flex items-center gap-4 border-l-4 border-l-neutral bg-primary-soft px-4 py-4 max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-2">
      <span class="font-display text-[2.4rem] leading-none font-bold">${percent} %</span>
      <div class="flex flex-1 flex-col gap-2">
        <span class="flex items-center justify-between gap-3 text-[0.78rem]"><strong>Avance</strong>
        <span class="pildora ${STAGE_CLASSES[stage]}">${STAGE_NAMES[stage]}</span></span>
        <div class="${BARRA_AVANCE}"><div class="${RELLENO_AVANCE}" style="width: ${percent}%"></div></div>
      </div>
    </div>
    <form id="obra-form" class="grid grid-cols-2 items-start gap-7 max-tablet:grid-cols-1" novalidate>
      <div class="flex flex-col gap-[18px]">
        ${field({ id: "obra-nota", label: "Nota", value: work.nota, max: LARGOS.obra.nota, area: true , required: true })}
        <div>
          <span class="block text-[0.82rem] font-bold">Hitos</span>
          <p class="m-0 mb-1.5 text-[0.74rem] text-muted">Marca cada fase cuando termine.</p>
          <div id="obra-hitos">${hitos}</div>
          <button type="button" id="hito-agregar" class="${GHOST} mt-2.5" ${work.hitos.length >= MAX_MILESTONES ? "disabled" : ""}>${iconSvg("plus", 18)} Añadir hito</button>
        </div>
      </div>
      ${evidencias(work.fotos)}
      ${acciones("/ciudadania/obras-en-ejecucion/", "col-span-2 max-tablet:col-span-1")}
    </form>`);
  section.innerHTML = `
    ${selector("obra-selector", "Obra", state.draft!.obras.map((w) => `<option value="${esc(w.slug)}" ${w.slug === selected ? "selected" : ""}>${esc(nameOf(w.slug))}</option>`).join(""))}
    ${form}`;
  bind(section);
  // Cada video publicado que su plataforma ya no deja mostrar se marca mientras siga en el borrador.
  for (const aviso of avisosActuales().filter((a) => a.clave.startsWith(`video:obra:${selected}:`))) {
    const i = work.fotos.findIndex((f) => "video" in f && f.video.enlace === aviso.valor);
    if (aviso.detalle && i >= 0) marcarNoInsertable(section, i, aviso.detalle);
  }
}

/** Conecta los controles del editor de obras. */
function bind(section: HTMLElement) {
  const form = section.querySelector<HTMLFormElement>("#obra-form")!;
  const edit = (change: () => void) => { capture(form); change(); renderWorks(section); };
  section.querySelector<HTMLSelectElement>("#obra-selector")!.addEventListener("change", (e) => edit(() => { selected = (e.target as HTMLSelectElement).value; enlaceNuevo = ""; }));
  form.querySelectorAll<HTMLInputElement>('[name="completado"]').forEach((c) => c.addEventListener("change", () => edit(() => {})));
  form.querySelector("#hito-agregar")!.addEventListener("click", () => edit(() => trabajo[selected].hitos.push({ nombre: "", completado: false })));
  enlazarLista(form, () => trabajo[selected].hitos, edit);
  form.querySelectorAll<HTMLButtonElement>("[data-quitar-evidencia]").forEach((b) => b.addEventListener("click", () =>
    edit(() => trabajo[selected].fotos.splice(Number(b.dataset.quitarEvidencia), 1))));
  form.querySelector<HTMLInputElement>("#obra-fotos")?.addEventListener("change", (e) => {
    const fotos = trabajo[selected].fotos.filter((f) => !("video" in f)).length;
    const files = [...((e.target as HTMLInputElement).files ?? [])].slice(0, MAX_FOTOS_OBRA - fotos);
    if (!files.length) return;
    capture(form);
    const destino = selected;
    void subirFotos(e.target as HTMLInputElement, files, (foto) => {
      const abierto = document.querySelector<HTMLFormElement>("#obra-form");
      if (destino === selected && abierto) capture(abierto);
      trabajo[destino].fotos.push({ ...foto, pie: "" });
      if (destino === selected) renderWorks(section);
    }).then((todas) => todas && notify("Fotos subidas. Escribe un pie para cada una y guarda el borrador."));
  });
  bindVideos(section, form);
  vigilarCambios(form, form.querySelector("button[type=submit]")!, saved(state.draft!.obras.find((w) => w.slug === selected)!), () => {
    capture(form);
    return saved(trabajo[selected]);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capture(form);
    const slug = selected, work = trabajo[slug];
    if (!work.nota || work.hitos.some((h) => !h.nombre) || work.fotos.some((f) => !f.pie))
      return avisarVacios(form, "Completa la nota, el nombre de cada hito y el pie de cada foto y video.");
    void busy(form.querySelector("button[type=submit]"), () => guardarYRecargar(async () => {
      try {
        await adminApi.saveWork(slug, { nota: work.nota, hitos: work.hitos, fotos: work.fotos.map(cuerpo) }, state.draft!.versiones.obras[slug]);
      } catch (error) {
        const enlaces = work.fotos.flatMap((f) => ("video" in f ? [f.video.enlace] : []));
        const rechazo = videoRechazado(error, enlaces);
        if (!rechazo) throw error;
        marcarNoInsertable(section, work.fotos.findIndex((f) => "video" in f && f.video.enlace === enlaces[rechazo.i]), rechazo.texto);
        throw new Error(`Quita el video ${rechazo.i + 1} y añade otro.`);
      }
    }, () => {
        delete trabajo[slug];
        renderWorks(section);
      }));
  });
}

/** Pone `foto` de portada al video `enlace` de la obra `destino` si sigue en la lista, sin perder lo escrito ni el foco. */
function ponerPortada(section: HTMLElement, destino: string, enlace: string, foto: Photo) {
  const abierto = section.querySelector<HTMLFormElement>("#obra-form");
  if (abierto) capture(abierto);
  const item = trabajo[destino]?.fotos.find((f) => "video" in f && f.video.enlace === enlace);
  if (!item || !("video" in item)) return;
  item.video.portada = foto;
  if (destino !== selected) return;
  const foco = document.activeElement?.id;
  renderWorks(section);
  if (foco) section.querySelector<HTMLElement>(`#${CSS.escape(foco)}`)?.focus({ preventScroll: true });
}

/** Enlaza el campo del enlace nuevo, «Añadir video», la reproducción y «Cambiar portada» de cada video. */
function bindVideos(section: HTMLElement, form: HTMLFormElement) {
  form.querySelectorAll<HTMLButtonElement>("[data-ver-video]").forEach((boton) => {
    const i = boton.dataset.verVideo!, item = trabajo[selected].fotos[Number(i)];
    const reproductor = form.querySelector<HTMLElement>(`[data-reproductor="${i}"]`)!;
    const source = "video" in item ? videoSource(item.video.enlace) : null;
    if (!source) return;
    boton.addEventListener("click", () => {
      mountPlayer(reproductor.querySelector<HTMLElement>("[data-video-stage]")!, source, boton.getAttribute("aria-label")!);
      reproductor.hidden = false;
    });
    reproductor.querySelector("[data-cerrar-video]")!.addEventListener("click", () => {
      reproductor.querySelector("iframe, video")?.remove();
      reproductor.hidden = true;
      boton.focus({ preventScroll: true });
    });
  });
  const nuevo = form.querySelector<HTMLInputElement>("#video-enlace-nuevo");
  const anadir = form.querySelector<HTMLButtonElement>("[data-anadir-video]");
  const comprobar = () => { anadir!.disabled = !comprobarEnlace(form, "nuevo", false); };
  if (nuevo?.value) comprobar();
  nuevo?.addEventListener("input", comprobar);
  anadir?.addEventListener("click", () => {
    const source = videoSource(nuevo!.value);
    if (!source) return;
    capture(form);
    const destino = selected;
    trabajo[destino].fotos.push({ video: { enlace: source.url, vertical: source.vertical, portada: null }, pie: "" });
    enlaceNuevo = "";
    renderWorks(section);
    section.querySelector<HTMLElement>(`#evidencia-pie-${trabajo[destino].fotos.length - 1}`)?.focus();
    if (source.provider === "mp4") return;
    void busy(null, async () => {
      ponerPortada(section, destino, source.url, await adminApi.videoCover(source.url));
      notify("Se usa la imagen del video como portada. Puedes cambiarla por otra.");
    }, "Cargando la imagen…");
  });
  form.querySelectorAll<HTMLInputElement>('input[type=file][id^="video-portada-"]').forEach((campo) => campo.addEventListener("change", () => {
    const archivo = campo.files?.[0];
    const item = trabajo[selected].fotos[Number(campo.id.split("-").at(-1))];
    if (!archivo || !("video" in item)) return;
    capture(form);
    const destino = selected, enlace = item.video.enlace;
    void subirFotos(campo, [archivo], (foto) => ponerPortada(section, destino, enlace, foto));
  }));
}
