import { vigilarCambios } from "../../../../lib/cuenta/panel/cambios";
import { adminApi, type ChatAnswer } from "../../../../lib/data/http/admin-api";
import { busy, card, DANGER, DRAFT_PILL, esc, field, GHOST, ICON_BUTTON, iconSvg, isPending, notify, previewButton, reloadDraft, reloadPending, state, value } from "../ui";

const MAX_ITEMS = 60;
// Copia de trabajo: la lista se edita entera y se guarda de una vez (orden incluido).
let items: ChatAnswer[] | null = null;
let open = 0;

/** Pasa a la copia de trabajo lo escrito en cada pregunta. */
function capture(form: HTMLElement) {
  items = [...form.querySelectorAll<HTMLElement>(".faq")].map((row, i) => ({
    pregunta: value(row, `#faq-pregunta-${i}`), palabrasClave: value(row, `#faq-claves-${i}`),
    respuesta: value(row, `#faq-respuesta-${i}`), enlaceTexto: value(row, `#faq-enlace-texto-${i}`) || null,
    enlaceRuta: value(row, `#faq-enlace-ruta-${i}`) || null,
    destacada: row.querySelector<HTMLInputElement>(`#faq-destacada-${i}`)!.checked,
  }));
}

const row = (c: ChatAnswer, i: number, total: number) => `
  <details class="faq border-t border-t-base-300 py-3 first:border-t-0" ${i === open ? "open" : ""}>
    <summary class="flex min-h-11 cursor-pointer items-center justify-between gap-2.5 text-[0.9rem] font-bold">
      <span>${esc(c.pregunta || "Nueva pregunta")}</span>
      ${c.destacada ? `<span class="inline-flex shrink-0 items-center rounded-full border border-base-300 px-3 py-1 text-[0.66rem] tracking-[0.08em] uppercase">Botón</span>` : ""}
    </summary>
    <div class="mt-3 flex flex-col gap-3.5">
      ${field({ id: `faq-pregunta-${i}`, label: "Pregunta", value: c.pregunta, max: 160, hint: "Si se marca como botón, es el texto del botón." })}
      ${field({ id: `faq-claves-${i}`, label: "Palabras clave", value: c.palabrasClave, max: 300, hint: "Separadas por comas." })}
      ${field({ id: `faq-respuesta-${i}`, label: "Respuesta", value: c.respuesta, max: 1000, area: true })}
      <div class="grid grid-cols-2 gap-3 max-tablet:grid-cols-1">
        ${field({ id: `faq-enlace-texto-${i}`, label: "Texto del enlace (opcional)", value: c.enlaceTexto ?? "", max: 60 })}
        ${field({ id: `faq-enlace-ruta-${i}`, label: "Página del sitio (opcional)", value: c.enlaceRuta ?? "", max: 200, hint: "Por ejemplo /propuestas/agua-potable/" })}
      </div>
      <label class="flex min-h-11 items-center gap-2.5 text-[0.85rem]">
        <input type="checkbox" id="faq-destacada-${i}" class="size-5 accent-neutral" ${c.destacada ? "checked" : ""} /> Mostrar como botón de respuesta rápida
      </label>
      <div class="flex flex-wrap gap-1">
        <button type="button" class="${ICON_BUTTON}" data-mover="-1" data-indice="${i}" aria-label="Subir pregunta ${i + 1}" ${i === 0 ? "disabled" : ""}>${iconSvg("up", 18)}</button>
        <button type="button" class="${ICON_BUTTON}" data-mover="1" data-indice="${i}" aria-label="Bajar pregunta ${i + 1}" ${i === total - 1 ? "disabled" : ""}>${iconSvg("chevron", 18)}</button>
        <button type="button" class="${DANGER}" data-quitar="${i}">${iconSvg("trash", 18)} Quitar pregunta</button>
      </div>
    </div>
  </details>`;

export async function renderChat(section: HTMLElement) {
  items ??= structuredClone(state.draft!.chat);
  section.innerHTML = `${card("Preguntas frecuentes", `
    ${isPending("Chat", "Preguntas frecuentes") ? `<p class="-mt-2 mb-5"><span class="${DRAFT_PILL}">Borrador sin publicar</span></p>` : ""}
    <p class="m-0 mb-3 text-[0.85rem]">Cada respuesta se muestra cuando la pregunta de la persona contiene sus palabras clave.</p>
    <form id="chat-form-panel" novalidate>
      <div id="faqs">${items.map((c, i) => row(c, i, items!.length)).join("")}</div>
      <div class="mt-4 flex flex-wrap justify-between gap-2.5 border-t border-t-base-300 pt-[18px] max-tablet:flex-col">
        <button type="button" id="faq-agregar" class="${GHOST}" ${items.length >= MAX_ITEMS ? "disabled" : ""}>${iconSvg("plus", 18)} Añadir pregunta</button>
        <span class="flex flex-wrap gap-2.5 max-tablet:flex-col-reverse">
          ${previewButton("/ciudadania/chat/")}
          <button type="submit" class="button">Guardar borrador</button>
        </span>
      </div>
    </form>`)}
    <div id="sin-respuesta" class="mt-7"></div>`;
  bind(section);
  await drawUnanswered(section);
}

function bind(section: HTMLElement) {
  const form = section.querySelector<HTMLFormElement>("#chat-form-panel")!;
  const edit = (change: () => void) => { capture(form); change(); void renderChat(section); };
  vigilarCambios(form, form.querySelector("button[type=submit]")!, state.draft!.chat, () => { capture(form); return items; });
  form.querySelectorAll<HTMLButtonElement>("[data-mover]").forEach((b) => b.addEventListener("click", () => edit(() => {
    const i = Number(b.dataset.indice), j = i + Number(b.dataset.mover);
    [items![i], items![j]] = [items![j], items![i]];
    open = j;
  })));
  form.querySelectorAll<HTMLButtonElement>("[data-quitar]").forEach((b) => b.addEventListener("click", () => edit(() => {
    items!.splice(Number(b.dataset.quitar), 1);
  })));
  form.querySelector("#faq-agregar")!.addEventListener("click", () => edit(() => {
    items!.push({ pregunta: "", palabrasClave: "", respuesta: "", enlaceTexto: null, enlaceRuta: null, destacada: false });
    open = items!.length - 1;
  }));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capture(form);
    const incomplete = items!.findIndex((c) => !c.pregunta || !c.palabrasClave || !c.respuesta || !c.enlaceTexto !== !c.enlaceRuta);
    if (incomplete >= 0) {
      open = incomplete;
      void renderChat(section);
      return notify("Completa pregunta, palabras clave y respuesta; el enlace necesita texto y página.", true);
    }
    void busy(form.querySelector("button[type=submit]"), async () => {
      await adminApi.saveChat(items!, state.draft!.versiones.chat);
      await Promise.all([reloadDraft(), reloadPending()]);
      items = null;
      await renderChat(section);
      notify("Preguntas del chat guardadas como borrador. Publica para que el chat las use.");
    });
  });
}

async function drawUnanswered(section: HTMLElement) {
  const container = section.querySelector<HTMLElement>("#sin-respuesta")!;
  const { preguntas } = await adminApi.unanswered();
  container.innerHTML = card("Preguntas sin respuesta", preguntas.length ? `
    <p class="m-0 mb-2 text-[0.8rem]">Lo que la gente preguntó y el chat no supo responder, de más a menos repetido.</p>
    <ul class="m-0 list-none p-0">${preguntas.map((p) => `
      <li class="flex flex-wrap items-center justify-between gap-2.5 border-t border-t-base-300 py-3 first:border-t-0">
        <span class="min-w-0 flex-1 text-[0.86rem] [overflow-wrap:anywhere]">${esc(p.ejemplo)} <small class="text-[#50617d]">· ${p.veces} ${p.veces === 1 ? "vez" : "veces"}</small></span>
        <span class="flex flex-wrap gap-2">
          <button type="button" class="${GHOST}" data-crear="${esc(p.ejemplo)}">${iconSvg("plus", 16)} Crear respuesta</button>
          <button type="button" class="${GHOST}" data-descartar="${esc(p.clave)}">Descartar</button>
        </span>
      </li>`).join("")}</ul>` : `<p class="m-0 text-[0.86rem]">Por ahora el chat respondió todo lo que le preguntaron.</p>`);
  container.querySelectorAll<HTMLButtonElement>("[data-crear]").forEach((b) => b.addEventListener("click", () => {
    capture(section.querySelector("#chat-form-panel")!);
    items!.push({ pregunta: b.dataset.crear!, palabrasClave: "", respuesta: "", enlaceTexto: null, enlaceRuta: null, destacada: false });
    open = items!.length - 1;
    void renderChat(section).then(() => section.querySelector<HTMLInputElement>(`#faq-claves-${open}`)?.focus());
  }));
  container.querySelectorAll<HTMLButtonElement>("[data-descartar]").forEach((b) => b.addEventListener("click", () =>
    busy(b, async () => {
      await adminApi.discardUnanswered(b.dataset.descartar!);
      await drawUnanswered(section);
    })));
}
