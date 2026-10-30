import { MAX_FOTOS_PARROQUIA, PARROQUIAS } from "../../../../../../backend/src/contracts/parroquias";
import { vigilarCambios } from "../../../../lib/cuenta/panel/cambios";
import { adminApi, type DraftMyTeam } from "../../../../lib/data/http/admin-api";
import { busy, DRAFT_PILL, esc, field, FORMATOS_FOTO, HINT, isPending, moveButtons, notify, previewButton, reloadDraft, reloadPending, state, thumb, upload, value } from "../ui";

type Parroquia = DraftMyTeam["parroquias"][number];
let elegida: string = PARROQUIAS[0].slug;
// Una copia por parroquia: cambiar de parroquia o de sección no pierde lo escrito.
const trabajo: Record<string, Parroquia> = {};

const nombre = (slug: string) => PARROQUIAS.find((p) => p.slug === slug)!.nombre;
const delBorrador = (slug: string) => state.draft!.miEquipo.parroquias.find((p) => p.slug === slug)!;
const paraGuardar = (p: Parroquia) => ({ texto: p.texto, fotos: p.fotos.map((f) => ({ idMedio: f.foto.idMedio, alt: f.alt })) });

function capturar(form: HTMLElement) {
  const p = trabajo[elegida];
  trabajo[elegida] = { ...p, texto: value(form, "#parroquia-texto"), fotos: p.fotos.map((f, i) => ({ ...f, alt: value(form, `#parroquia-foto-${i}`) })) };
}

export function renderParishes(body: HTMLElement, rerender: () => void) {
  const p = (trabajo[elegida] ??= structuredClone(delBorrador(elegida)));
  const fotos = p.fotos.map((f, i) => `
    <li class="flex min-w-0 flex-col gap-3 rounded-[3px] border border-base-300 p-3">
      <img src="${esc(thumb(f.foto))}" alt="" class="aspect-[4/3] w-full rounded-[3px] object-cover" />
      ${field({ id: `parroquia-foto-${i}`, label: "Descripción de la foto", value: f.alt, max: 200, hint: "Se lee debajo de la foto." })}
      <div class="flex flex-wrap gap-1">${moveButtons("foto", i, p.fotos.length, `foto ${i + 1}`)}</div>
    </li>`).join("");
  body.innerHTML = `
    <div class="mb-5 flex items-center gap-3.5 max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-1.5">
      <label for="parroquia-selector" class="text-[0.82rem] font-bold">Parroquia</label>
      <select id="parroquia-selector" class="min-h-12 min-w-[320px] rounded-[3px] border border-field-border bg-base-100 px-3.5 text-sm text-primary max-tablet:min-w-0">
        ${PARROQUIAS.map((x) => `<option value="${x.slug}" ${x.slug === elegida ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
      </select>
    </div>
    ${isPending("Mi equipo", nombre(elegida)) ? `<p class="mb-5"><span class="${DRAFT_PILL}">Borrador sin publicar</span></p>` : ""}
    <form id="parroquia-form" novalidate>
      ${field({ id: "parroquia-texto", label: "Texto", value: p.texto, max: 3000, area: true, hint: "Deja una línea en blanco entre párrafos. Es opcional." })}
      <h3 class="mt-6 mb-3 font-sans text-[0.95rem] font-bold">Fotos</h3>
      ${p.fotos.length ? `<ol class="m-0 grid list-none grid-cols-3 gap-4 p-0 max-laptop:grid-cols-2 max-tablet:grid-cols-1">${fotos}</ol>` : `<p class="m-0 text-[0.85rem]">Esta parroquia todavía no tiene fotos.</p>`}
      ${p.fotos.length < MAX_FOTOS_PARROQUIA ? `<div class="mt-4">${upload("parroquia-fotos", "Subir fotos", true)}</div>` : ""}
      <p class="${HINT}">Hasta ${MAX_FOTOS_PARROQUIA} fotos, en el orden en que se muestran. ${FORMATOS_FOTO} de hasta 8 MB, de 2000 × 1200 px o más (horizontal).</p>
      <div class="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-t-base-300 pt-[18px] max-tablet:flex-col-reverse">
        ${previewButton("/mi-equipo/")}
        <button type="submit" class="button">Guardar borrador</button>
      </div>
    </form>`;
  const form = body.querySelector<HTMLFormElement>("#parroquia-form")!;
  const editar = (cambio: () => void) => { capturar(form); cambio(); rerender(); };
  body.querySelector<HTMLSelectElement>("#parroquia-selector")!.addEventListener("change", (e) => editar(() => { elegida = (e.target as HTMLSelectElement).value; }));
  form.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((b) => b.addEventListener("click", () => editar(() => {
    const lista = trabajo[elegida].fotos, i = Number(b.dataset.index), j = i + Number(b.dataset.step);
    [lista[i], lista[j]] = [lista[j], lista[i]];
  })));
  form.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((b) => b.addEventListener("click", () => editar(() => trabajo[elegida].fotos.splice(Number(b.dataset.index), 1))));
  form.querySelector<HTMLInputElement>("#parroquia-fotos")?.addEventListener("change", (e) => {
    const archivos = [...((e.target as HTMLInputElement).files ?? [])].slice(0, MAX_FOTOS_PARROQUIA - trabajo[elegida].fotos.length);
    if (!archivos.length) return;
    capturar(form);
    const destino = elegida;
    void busy(null, async () => {
      for (const [i, archivo] of archivos.entries()) {
        notify(`Subiendo foto ${i + 1} de ${archivos.length}…`);
        const foto = await adminApi.upload(archivo);
        const abierto = document.querySelector<HTMLFormElement>("#parroquia-form");
        if (destino === elegida && abierto) capturar(abierto);
        trabajo[destino].fotos.push({ foto, alt: "" });
        if (destino === elegida) rerender();
      }
      notify("Fotos subidas. Describe cada una y guarda el borrador.");
    });
  });
  vigilarCambios(form, form.querySelector("button[type=submit]")!, paraGuardar(delBorrador(elegida)), () => {
    capturar(form);
    return paraGuardar(trabajo[elegida]);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capturar(form);
    if (trabajo[elegida].fotos.some((f) => !f.alt)) return notify("Describe cada foto antes de guardar.", true);
    const slug = elegida;
    void busy(form.querySelector("button[type=submit]"), async () => {
      await adminApi.saveParish(slug, paraGuardar(trabajo[slug]), state.draft!.versiones.miEquipo[slug] ?? null);
      await Promise.all([reloadDraft(), reloadPending()]);
      delete trabajo[slug];
      rerender();
      notify(`Borrador de «${nombre(slug)}» guardado. Publica para que se vea en el sitio.`);
    });
  });
  return () => capturar(form);
}
