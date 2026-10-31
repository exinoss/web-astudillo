import { MAX_EQUIPO } from "../../../../../../backend/src/contracts/parroquias";
import { vigilarCambios } from "../../../../lib/cuenta/panel/cambios";
import { adminApi, type Photo } from "../../../../lib/data/http/admin-api";
import { silueta } from "../../../../lib/mi-equipo/silueta";
import { busy, DRAFT_PILL, esc, field, FORMATOS_FOTO, GHOST, HINT, iconSvg, isPending, moveButtons, notify, previewButton, reloadDraft, reloadPending, state, thumb, upload, value } from "../ui";

// `clave` sigue a la persona aunque se reordene mientras sube su foto.
interface Persona { clave: string; nombre: string; quien: string; foto: Photo | null }
let personas: Persona[] | null = null;

const desdeBorrador = (): Persona[] => state.draft!.miEquipo.equipo.map((p) => ({ clave: crypto.randomUUID(), nombre: p.nombre, quien: p.quien ?? "", foto: p.foto }));
const paraGuardar = (lista: { nombre: string; quien: string | null; foto: Photo | null }[]) =>
  lista.map((p) => ({ idMedio: p.foto?.idMedio ?? null, nombre: p.nombre, quien: p.quien ?? "" }));

function capturar(form: HTMLElement) {
  personas = personas!.map((p, i) => ({ ...p, nombre: value(form, `#persona-nombre-${i}`), quien: value(form, `#persona-quien-${i}`) }));
}

export function renderTeam(body: HTMLElement, rerender: () => void) {
  personas ??= desdeBorrador();
  const tarjetas = personas.map((p, i) => `
    <li class="flex gap-4 rounded-[3px] border border-base-300 p-3 max-mobile:flex-col">
      <div class="flex w-[160px] shrink-0 flex-col gap-2 max-mobile:w-full max-mobile:flex-row max-mobile:flex-wrap max-mobile:items-end">
        ${p.foto ? `<img src="${esc(thumb(p.foto))}" alt="" class="aspect-[3/4] w-full rounded-[3px] object-cover max-mobile:w-[100px]" />` : silueta("block aspect-[3/4] w-full rounded-[3px] max-mobile:w-[100px]")}
        <div class="flex flex-col gap-2">
          ${upload(`persona-foto-${i}`, p.foto ? "Cambiar foto" : "Subir foto")}
          ${p.foto ? `<button type="button" class="${GHOST}" data-quitar-foto="${i}">Quitar foto</button>` : ""}
        </div>
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-3">
        ${field({ id: `persona-nombre-${i}`, label: "Nombre", value: p.nombre, max: 80 })}
        ${field({ id: `persona-quien-${i}`, label: "Quién es", value: p.quien, max: 60, hint: "Por ejemplo: Concejala rural. Es opcional." })}
        <div class="mt-auto flex flex-wrap gap-1">${moveButtons("persona", i, personas!.length, p.nombre || `persona ${i + 1}`)}</div>
      </div>
    </li>`).join("");
  body.innerHTML = `
    ${isPending("Mi equipo", "Equipo") ? `<p class="-mt-2 mb-5"><span class="${DRAFT_PILL}">Borrador sin publicar</span></p>` : ""}
    <form id="equipo-form" novalidate>
      <ol class="m-0 grid list-none grid-cols-2 gap-4 p-0 max-laptop:grid-cols-1">${tarjetas}</ol>
      ${personas.length < MAX_EQUIPO ? `<button type="button" id="persona-agregar" class="${GHOST} mt-4">${iconSvg("plus", 17)} Añadir a alguien</button>` : ""}
      <p class="${HINT}">Hasta ${MAX_EQUIPO} personas, en el orden de la página. Foto vertical y opcional: ${FORMATOS_FOTO} de hasta 8 MB, de 700 × 930 px o más.</p>
      <div class="mt-6 flex flex-wrap justify-end gap-2.5 border-t border-t-base-300 pt-[18px] max-tablet:flex-col-reverse">
        ${previewButton("/mi-equipo/")}
        <button type="submit" class="button">Guardar borrador</button>
      </div>
    </form>`;
  const form = body.querySelector<HTMLFormElement>("#equipo-form")!;
  const editar = (cambio: () => void) => { capturar(form); cambio(); rerender(); };
  form.querySelector("#persona-agregar")?.addEventListener("click", () => {
    editar(() => personas!.push({ clave: crypto.randomUUID(), nombre: "", quien: "", foto: null }));
    document.querySelector<HTMLInputElement>(`#persona-nombre-${personas!.length - 1}`)?.focus();
  });
  form.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((b) => b.addEventListener("click", () => editar(() => {
    const i = Number(b.dataset.index), j = i + Number(b.dataset.step);
    [personas![i], personas![j]] = [personas![j], personas![i]];
  })));
  form.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((b) => b.addEventListener("click", () => editar(() => personas!.splice(Number(b.dataset.index), 1))));
  form.querySelectorAll<HTMLButtonElement>("[data-quitar-foto]").forEach((b) => b.addEventListener("click", () => editar(() => { personas![Number(b.dataset.quitarFoto)].foto = null; })));
  personas.forEach((p, i) => form.querySelector<HTMLInputElement>(`#persona-foto-${i}`)!.addEventListener("change", (e) => {
    const archivo = (e.target as HTMLInputElement).files?.[0];
    if (!archivo) return;
    capturar(form);
    void busy(null, async () => {
      notify("Subiendo la foto…");
      const foto = await adminApi.upload(archivo);
      const persona = personas?.find((x) => x.clave === p.clave);
      if (!persona) return notify("Esa persona ya no está en la lista; la foto no se añadió.", true);
      persona.foto = foto;
      rerender();
      notify("Foto subida. Guarda el borrador para conservarla.");
    }, "Subiendo…");
  }));
  vigilarCambios(form, form.querySelector("button[type=submit]")!, paraGuardar(state.draft!.miEquipo.equipo), () => {
    capturar(form);
    return paraGuardar(personas!);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capturar(form);
    if (personas!.some((p) => !p.nombre)) return notify("Escribe el nombre de cada persona.", true);
    void busy(form.querySelector("button[type=submit]"), async () => {
      await adminApi.saveTeam(paraGuardar(personas!), state.draft!.versiones.miEquipo.equipo ?? null);
      await Promise.all([reloadDraft(), reloadPending()]);
      personas = null;
      rerender();
      notify("Borrador del equipo guardado. Publica para que se vea en el sitio.");
    });
  });
  return () => capturar(form);
}

