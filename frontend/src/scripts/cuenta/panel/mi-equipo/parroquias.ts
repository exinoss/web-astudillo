import { MAX_FOTOS_PARROQUIA, PARROQUIAS } from "../../../../../../backend/src/contracts/parroquias";
import { vigilarCambios } from "../../../../lib/comun/cambios";
import { adminApi, type DraftMyTeam } from "../../../../lib/data/http/admin-api";
import { acciones, avisarVacios, avisoBorrador, busy, enlazarLista, esc, field, FORMATOS_FOTO, guardarYRecargar, HINT, isPending, LARGOS, MAX_MB_FOTO, moveButtons, notify, selector, state, subirFotos, thumb, upload, value } from "../ui";

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
    <li class="flex min-w-0 flex-col gap-3 rounded-control border border-base-300 p-3">
      <img src="${esc(thumb(f.foto))}" alt="" class="aspect-[4/3] w-full rounded-control object-cover" />
      ${field({ id: `parroquia-foto-${i}`, label: "Descripción de la foto", value: f.alt, max: LARGOS.descripcionFoto, hint: "Se lee debajo de la foto." , required: true })}
      <div class="flex flex-wrap gap-1">${moveButtons("foto", i, p.fotos.length, `foto ${i + 1}`)}</div>
    </li>`).join("");
  body.innerHTML = `
    ${selector("parroquia-selector", "Parroquia", PARROQUIAS.map((x) => `<option value="${x.slug}" ${x.slug === elegida ? "selected" : ""}>${esc(x.nombre)}</option>`).join(""))}
    ${avisoBorrador(isPending("Mi equipo", nombre(elegida)), "mb-5")}
    <form id="parroquia-form" novalidate>
      ${field({ id: "parroquia-texto", label: "Texto", value: p.texto, max: LARGOS.equipo.textoParroquia, area: true, hint: "Deja una línea en blanco entre párrafos. Es opcional." })}
      <h3 class="mt-6 mb-3 font-sans text-[0.95rem] font-bold">Fotos</h3>
      ${p.fotos.length ? `<ol class="m-0 grid list-none grid-cols-3 gap-4 p-0 max-laptop:grid-cols-2 max-tablet:grid-cols-1">${fotos}</ol>` : `<p class="m-0 text-[0.85rem]">Esta parroquia todavía no tiene fotos.</p>`}
      ${p.fotos.length < MAX_FOTOS_PARROQUIA ? `<div class="mt-4">${upload("parroquia-fotos", "Subir fotos", true)}</div>` : ""}
      <p class="${HINT}">Hasta ${MAX_FOTOS_PARROQUIA} fotos, en el orden en que se muestran. ${FORMATOS_FOTO} de hasta ${MAX_MB_FOTO} MB, de 2000 × 1200 px o más (horizontal).</p>
      ${acciones("/mi-equipo/", "mt-6")}
    </form>`;
  const form = body.querySelector<HTMLFormElement>("#parroquia-form")!;
  const editar = (cambio: () => void) => { capturar(form); cambio(); rerender(); };
  body.querySelector<HTMLSelectElement>("#parroquia-selector")!.addEventListener("change", (e) => editar(() => { elegida = (e.target as HTMLSelectElement).value; }));
  enlazarLista(form, () => trabajo[elegida].fotos, editar);
  form.querySelector<HTMLInputElement>("#parroquia-fotos")?.addEventListener("change", (e) => {
    const archivos = [...((e.target as HTMLInputElement).files ?? [])].slice(0, MAX_FOTOS_PARROQUIA - trabajo[elegida].fotos.length);
    if (!archivos.length) return;
    capturar(form);
    const destino = elegida;
    void subirFotos(archivos, (foto) => {
      const abierto = document.querySelector<HTMLFormElement>("#parroquia-form");
      if (destino === elegida && abierto) capturar(abierto);
      trabajo[destino].fotos.push({ foto, alt: "" });
      if (destino === elegida) rerender();
    }).then((todas) => todas && notify("Fotos subidas. Describe cada una y guarda el borrador."));
  });
  vigilarCambios(form, form.querySelector("button[type=submit]")!, paraGuardar(delBorrador(elegida)), () => {
    capturar(form);
    return paraGuardar(trabajo[elegida]);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    capturar(form);
    if (trabajo[elegida].fotos.some((f) => !f.alt)) return avisarVacios(form, "Describe cada foto antes de guardar.");
    const slug = elegida;
    void busy(form.querySelector("button[type=submit]"), () => guardarYRecargar(
      () => adminApi.saveParish(slug, paraGuardar(trabajo[slug]), state.draft!.versiones.miEquipo[slug] ?? null), () => {
        delete trabajo[slug];
        rerender();
      }));
  });
  return () => capturar(form);
}
