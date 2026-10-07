// Modo edición sobre el sitio: solo lo descarga quien tiene `contenido.editar` (lo importa layout.ts).
// Edita los textos marcados con data-editable; los botones y destinos de enlaces nunca lo llevan.
import { TEXTOS, type TextKey } from "../../lib/comun/contenido/textos";
import type { Profile } from "../../lib/data/auth-repository";
import { adminApi } from "../../lib/data/http/admin-api";
import { escLines } from "../../lib/comun/html";
import { iconSvg } from "../../lib/comun/iconos";

const STORAGE = "modo-edicion";
const BUTTON = "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-[3px] px-[18px] text-[0.82rem] font-bold whitespace-nowrap";
const IDLE = ["outline-1", "outline-dashed", "outline-current/40", "outline-offset-[6px]", "rounded-[2px]", "cursor-text",
  "hover:outline-2", "hover:outline-current", "focus-visible:outline-2", "focus-visible:outline-current"];
const ACTIVE = ["outline-2", "outline-solid", "outline-secondary", "bg-[#fffbe8]", "text-primary"];
const mobile = matchMedia("(width <= 760px)");

const elements = () => [...document.querySelectorAll<HTMLElement>("[data-editable]")];
const published = new Map<HTMLElement, string>(); // HTML publicado, para restaurarlo al salir del modo
let texts: Record<string, string> = {};
let versions: Record<string, string> = {}; // versión de cada texto al cargar; detecta si otra persona guardó antes
let pending = 0;
let on = false;
let editing: { el: HTMLElement; before: string } | null = null;
let canPublish = false;

const read = () => { try { return localStorage.getItem(STORAGE) === "1"; } catch { return false; } };
const remember = (value: boolean) => { try { localStorage.setItem(STORAGE, value ? "1" : "0"); } catch { /* sin almacenamiento */ } };
const definition = (el: HTMLElement) => TEXTOS[el.dataset.editable as TextKey];
const current = (key: string) => texts[key] ?? "";

/** Pinta un valor como lo hace Editable.astro: cada salto de línea es un <br>. */
function paint(el: HTMLElement, value: string) {
  el.innerHTML = escLines(value);
}


const bar = document.createElement("div");
bar.className = "bg-primary text-primary-content";
bar.innerHTML = `
  <div class="site-container flex min-h-14 items-center justify-between gap-4 py-1.5 max-tablet:gap-2.5">
    <button type="button" id="edicion-interruptor" role="switch" aria-checked="false"
      class="flex min-h-11 items-center gap-3.5 text-left text-[0.85rem] font-bold max-tablet:gap-2.5 max-tablet:text-[0.78rem]">
      <span class="edicion-pista inline-flex h-6 w-[42px] shrink-0 items-center rounded-full bg-[#ffffff40] p-[3px] max-tablet:h-[22px] max-tablet:w-[38px]">
        <span class="edicion-bola size-[18px] rounded-full bg-primary-content max-tablet:size-4"></span>
      </span>
      <span><span id="edicion-estado">Modo edición desactivado</span><span id="edicion-ayuda" class="font-normal opacity-80 max-nav:hidden"></span></span>
    </button>
    <span class="flex items-center gap-3 max-tablet:gap-2">
      <span id="edicion-pendientes" class="text-[0.82rem] max-nav:hidden"></span>
      <a href="/cuenta/panel/#publicaciones" class="${BUTTON} border border-[#ffffff55] text-primary-content max-nav:hidden">Ver pendientes</a>
      <button type="button" id="edicion-publicar" class="${BUTTON} bg-accent text-primary disabled:bg-[#d5dbe3] disabled:text-[#50617d]" hidden>${iconSvg("upload", 18)}Publicar</button>
    </span>
  </div>`;
const toggle = bar.querySelector<HTMLButtonElement>("#edicion-interruptor")!;
const publishButton = bar.querySelector<HTMLButtonElement>("#edicion-publicar")!;

function drawBar() {
  toggle.setAttribute("aria-checked", String(on));
  const track = bar.querySelector<HTMLElement>(".edicion-pista")!;
  track.classList.toggle("bg-accent", on);
  track.classList.toggle("bg-[#ffffff40]", !on);
  track.classList.toggle("justify-end", on);
  bar.querySelector<HTMLElement>(".edicion-bola")!.classList.toggle("bg-primary-content", !on);
  bar.querySelector<HTMLElement>(".edicion-bola")!.classList.toggle("bg-primary", on);
  const count = pending === 1 ? "1 cambio sin publicar" : `${pending} cambios sin publicar`;
  bar.querySelector("#edicion-estado")!.textContent = on
    ? (mobile.matches ? `Edición · ${pending} ${pending === 1 ? "cambio" : "cambios"}` : "Modo edición activado") : "Modo edición desactivado";
  bar.querySelector("#edicion-ayuda")!.textContent = on ? " · Haz clic en un texto con contorno para cambiarlo" : "";
  bar.querySelector("#edicion-pendientes")!.textContent = count;
  publishButton.hidden = !canPublish;
  publishButton.disabled = !pending;
}

async function refreshPending() {
  if (canPublish) pending = (await adminApi.pending()).cambios.length;
  drawBar();
}


const toast = document.createElement("p");
toast.setAttribute("role", "status");
toast.className = "fixed bottom-4 left-1/2 z-[960] m-0 w-max max-w-[calc(100%-32px)] -translate-x-1/2 border-l-4 border-primary bg-[#eef4fb] px-4 py-3 text-[0.82rem] text-primary [box-shadow:0_10px_35px_#06317626] data-[error=true]:border-error data-[error=true]:bg-[#fff2f2] data-[error=true]:text-error";
toast.hidden = true;
let toastTimer = 0;

function notify(message: string, error = false) {
  toast.textContent = message;
  toast.dataset.error = String(error);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 5000);
}


const chip = document.createElement("span");
chip.className = "pointer-events-none fixed z-[940] flex items-center gap-2 rounded-[3px] bg-secondary px-2.5 py-[5px] text-[0.68rem] font-bold text-primary";
chip.innerHTML = `${iconSvg("edit", 14)} Editando · Enter guarda · Esc cancela`;
chip.hidden = true;

function placeChip() {
  if (!editing || chip.hidden) return;
  const rect = editing.el.getBoundingClientRect();
  chip.style.left = `${Math.max(8, rect.left - 6)}px`;
  chip.style.top = `${Math.max(8, rect.top - 38)}px`;
}

/** Texto tal como se guarda: sin espacios de más al inicio y al final de cada línea. */
const clean = (raw: string) => raw.replace(/\r/g, "").replace(/\u00a0/g, " ").split("\n").map((l) => l.trim()).join("\n").trim();

/** Valida y guarda en el borrador; si falla, el texto vuelve a como estaba. */
async function save(el: HTMLElement, raw: string, before: string) {
  const key = el.dataset.editable!;
  const def = definition(el);
  const value = clean(raw);
  if (value === current(key)) return true;
  if (!value) { notify("El texto no puede quedar vacío.", true); paint(el, before); return false; }
  if (value.length > def.max) { notify(`Máximo ${def.max} caracteres.`, true); paint(el, before); return false; }
  try {
    const saved = await adminApi.saveText(key, value, versions[key] ?? null);
    texts[key] = value;
    if (saved.version) versions[key] = saved.version;
    // Los textos compartidos (el lema, por ejemplo) cambian en todos los sitios de la página.
    for (const other of elements()) if (other.dataset.editable === key) paint(other, value);
    await refreshPending();
    notify("Guardado como borrador. Publica para que se vea en el sitio.");
    return true;
  } catch (error) {
    paint(el, before);
    notify(error instanceof Error ? error.message : "No se pudo guardar.", true);
    return false;
  }
}

function startInline(el: HTMLElement) {
  if (editing?.el === el) return;
  if (editing) finishInline(true);
  editing = { el, before: current(el.dataset.editable!) };
  el.classList.remove(...IDLE);
  el.classList.add(...ACTIVE);
  el.contentEditable = "plaintext-only";
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  getSelection()?.removeAllRanges();
  getSelection()?.addRange(range);
  chip.hidden = false;
  placeChip();
}

function finishInline(keep: boolean) {
  if (!editing) return;
  const { el, before } = editing;
  editing = null;
  chip.hidden = true;
  el.removeAttribute("contenteditable");
  el.classList.remove(...ACTIVE);
  if (on) el.classList.add(...IDLE);
  if (keep) void save(el, el.innerText, before);
  else paint(el, before);
}


const sheet = document.createElement("div");
sheet.className = "fixed inset-0 z-[945] flex items-end bg-[#06317640]";
sheet.hidden = true;
sheet.innerHTML = `
  <div role="dialog" aria-modal="true" aria-labelledby="edicion-hoja-titulo"
    class="flex w-full flex-col gap-3.5 rounded-t-[12px] border-t-4 border-t-secondary bg-base-100 px-5 pt-[18px] pb-[calc(22px+env(safe-area-inset-bottom,0px))] text-primary [box-shadow:0_-12px_30px_#06317630]">
    <div class="flex items-center justify-between">
      <strong id="edicion-hoja-titulo" class="flex items-center gap-2 text-[0.95rem]">${iconSvg("edit", 18)} Editar texto</strong>
      <button type="button" data-cerrar class="grid size-11 place-items-center" aria-label="Cerrar">${iconSvg("close", 20)}</button>
    </div>
    <div class="flex flex-col gap-[7px]">
      <label for="edicion-hoja-campo" id="edicion-hoja-etiqueta" class="text-[0.82rem] font-bold"></label>
      <textarea id="edicion-hoja-campo" rows="4" class="min-h-24 w-full rounded-[3px] border border-field-border bg-base-100 px-3.5 py-3 text-[0.88rem] leading-normal text-primary"></textarea>
    </div>
    <div class="flex gap-2.5">
      <button type="button" data-cerrar class="${BUTTON} flex-1 border border-[#06317640] text-primary">Cancelar</button>
      <button type="button" id="edicion-hoja-guardar" class="${BUTTON} flex-1 bg-primary text-primary-content disabled:bg-[#d5dbe3] disabled:text-[#50617d]">Guardar borrador</button>
    </div>
  </div>`;
const sheetField = sheet.querySelector<HTMLTextAreaElement>("#edicion-hoja-campo")!;
const sheetSave = sheet.querySelector<HTMLButtonElement>("#edicion-hoja-guardar")!;
let sheetTarget: HTMLElement | null = null;

const syncSheet = () => { sheetSave.disabled = !sheetTarget || clean(sheetField.value) === current(sheetTarget.dataset.editable!); };
sheetField.addEventListener("input", syncSheet);

function openSheet(el: HTMLElement) {
  sheetTarget = el;
  const def = definition(el);
  sheet.querySelector("#edicion-hoja-etiqueta")!.textContent = `${def.lugar} · ${def.campo}`;
  sheetField.value = current(el.dataset.editable!);
  sheetField.maxLength = def.max;
  syncSheet();
  sheet.hidden = false;
  sheetField.focus();
}

function closeSheet() {
  sheet.hidden = true;
  sheetTarget?.focus();
  sheetTarget = null;
}

sheet.addEventListener("click", (e) => {
  if (e.target === sheet || (e.target as Element).closest("[data-cerrar]")) closeSheet();
});
sheet.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
  // Foco atrapado dentro de la hoja mientras está abierta.
  if (e.key === "Tab") {
    const items = [...sheet.querySelectorAll<HTMLElement>("button, textarea")];
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
sheetSave.addEventListener("click", async () => {
  const el = sheetTarget!;
  sheetSave.disabled = true;
  const ok = await save(el, sheetField.value, current(el.dataset.editable!));
  if (ok) closeSheet();
  else syncSheet();
});


const edit = (el: HTMLElement) => (mobile.matches ? openSheet(el) : startInline(el));

async function setMode(value: boolean) {
  if (value && !on) {
    // Se muestra el borrador, no lo publicado, para ver lo pendiente mientras se edita.
    const draft = await adminApi.draft();
    texts = draft.textos;
    versions = draft.versiones.textos;
    for (const el of elements()) {
      published.set(el, el.innerHTML);
      paint(el, current(el.dataset.editable!));
      el.classList.add(...IDLE);
      el.tabIndex = 0;
      el.setAttribute("aria-description", "Texto editable: pulsa Enter para cambiarlo");
    }
  } else if (!value && on) {
    finishInline(true);
    for (const el of elements()) {
      el.classList.remove(...IDLE, ...ACTIVE);
      el.removeAttribute("tabindex");
      el.removeAttribute("aria-description");
      el.innerHTML = published.get(el) ?? el.innerHTML;
    }
    published.clear();
  }
  on = value;
  remember(value);
  drawBar();
}

/** Arranca la barra y, si estaba activo o se pidió `?editar=clave`, el modo edición. */
export async function startEditMode(profile: Profile) {
  canPublish = profile.permisos.includes("contenido.publicar");
  document.querySelector(".site-header")!.append(bar);
  document.body.append(chip, sheet, toast);

  toggle.addEventListener("click", () => void setMode(!on).catch(() => notify("No se pudo activar el modo edición.", true)));
  // Bloqueado mientras se envía; la API además es idempotente, así que un segundo envío no duplica.
  publishButton.addEventListener("click", async () => {
    publishButton.disabled = true;
    try {
      await adminApi.publish();
      notify("Publicación en cola. El sitio se actualizará en cerca de un minuto.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo publicar.", true);
    }
    await refreshPending().catch(() => drawBar());
  });

  // En modo edición los textos dentro de enlaces se editan en vez de navegar.
  document.addEventListener("click", (e) => {
    const el = on && (e.target as Element).closest<HTMLElement>("[data-editable]");
    if (!el) return;
    e.preventDefault();
    edit(el);
  }, true);
  document.addEventListener("keydown", (e) => {
    const el = (e.target as Element).closest?.<HTMLElement>("[data-editable]");
    if (!on || !el) return;
    if (editing?.el === el) {
      const multiline = current(el.dataset.editable!).includes("\n");
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finishInline(false); el.focus(); }
      else if (e.key === "Enter" && !(multiline && e.shiftKey)) { e.preventDefault(); finishInline(true); el.focus(); }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      edit(el);
    }
  }, true);
  document.addEventListener("focusout", (e) => {
    if (editing && e.target === editing.el) finishInline(true);
  });
  addEventListener("scroll", placeChip, { passive: true });
  addEventListener("resize", placeChip);
  mobile.addEventListener("change", () => { finishInline(true); drawBar(); });

  const requested = new URLSearchParams(location.search).get("editar");
  await refreshPending();
  if (read() || requested) await setMode(true);
  if (requested) {
    history.replaceState(null, "", location.pathname + location.hash);
    const target = elements().find((el) => el.dataset.editable === requested && el.getClientRects().length);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: document.documentElement.classList.contains("reduce-motion") ? "auto" : "smooth" });
      edit(target);
    }
  }
}
