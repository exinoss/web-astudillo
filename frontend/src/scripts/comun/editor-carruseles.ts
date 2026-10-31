// Lo carga modo-edicion.ts antes de pintar los textos del borrador: `publicado` guarda la portada tal como se publicó.
import { MAX_BANNERS, MAX_PIEZAS, type Carrusel, type Original } from "../../../../backend/src/contracts/inicio";
import { avisoMegapixeles, MAX_PIXELES } from "../../../../backend/src/contracts/media";
import { mostrarCarga } from "../../lib/comun/animaciones";
import { medidasArchivo } from "../../lib/comun/foto-local";
import { medidasFoto, uploadedSrcset, uploadedUrl } from "../../lib/comun/fotos";
import { iconSvg } from "../../lib/comun/iconos";
import { bloquearMientras, vigilarCambios } from "../../lib/cuenta/panel/cambios";
import { field, GHOST, HINT, ICON_BUTTON, moveButtons, thumb, upload } from "../../lib/cuenta/panel/campos";
import { adminApi, type Draft, type DraftHomeCarousels, type DraftHomeImage, type HomeImageBody } from "../../lib/data/http/admin-api";

type Principal = DraftHomeCarousels["principal"];
type Piezas = DraftHomeCarousels["piezas"];
type Version = { src: string; srcset: string; miniatura: string };
interface Opciones {
  avisar: (mensaje: string, error?: boolean) => void;
  alGuardar: () => Promise<void>;
  /** Prepara para editar los textos de una diapositiva nueva, como los que ya estaban al activar el modo. */
  decorar: (raiz: ParentNode) => void;
}

const BUTTON = "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-[3px] px-[18px] text-[0.82rem] font-bold whitespace-nowrap";
const LIMITE = "Máximo 8 MB.";
// Mismas clases que index.astro: una pieza subida no se ve más grande que su archivo.
const TOPE = ["m-auto", "max-h-[calc(var(--ancho-foto)/var(--proporcion))]", "max-w-(--ancho-foto)"];
const NOMBRES: Record<Carrusel, string> = { principal: "Carrusel principal", piezas: "Carrusel de piezas" };

const hero = document.querySelector<HTMLElement>('[data-carrusel-editable="principal"]')!;
const perfil = document.querySelector<HTMLElement>('[data-carrusel-editable="piezas"]')!;
const originales = JSON.parse(hero.dataset.originales!) as Record<Original, Version>;
const plantilla = hero.querySelector<HTMLTemplateElement>("template[data-plantilla-banner]")!;
const publicado = { hero: hero.innerHTML, perfil: perfil.innerHTML };

let opciones: Opciones;
let borrador: DraftHomeCarousels;
let versiones: Draft["versiones"]["inicio"] = {};

const miniatura = (imagen: DraftHomeImage) => ("foto" in imagen ? thumb(imagen.foto) : originales[imagen.original].miniatura);
const cuerpoImagen = (imagen: DraftHomeImage): HomeImageBody => ("foto" in imagen ? { idMedio: imagen.foto.idMedio } : { original: imagen.original });

const tarjetaBanner = (b: Principal["banners"][number], i: number, total: number) => `
  <li class="flex flex-col gap-3 rounded-[3px] border border-base-300 p-3">
    <div class="flex items-center justify-between gap-2">
      <strong class="text-[0.85rem]">Banner ${i + 1}</strong>
      <span class="flex">${moveButtons("banner", i, total, `banner ${i + 1}`, 1)}</span>
    </div>
    <div class="grid grid-cols-[minmax(0,260px)_minmax(0,1fr)] items-start gap-4 max-tablet:grid-cols-1">
      <img src="${miniatura(b.imagen)}" alt="" class="aspect-[1947/741] w-full rounded-[3px] bg-base-200 object-cover" />
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          ${b.celular
            ? `<img src="${thumb(b.celular)}" alt="" class="aspect-[4/3] w-[104px] rounded-[3px] bg-base-200 object-cover" />`
            : `<span class="grid aspect-[4/3] w-[104px] place-items-center rounded-[3px] border border-dashed border-field-border px-2 text-center text-[0.68rem] leading-tight text-[#50617d]">Sin imagen para celular</span>`}
          <span class="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span class="text-[0.82rem] font-bold">Imagen para celular <span class="font-normal">(opcional) · 1520 × 1140 px</span></span>
            <span class="flex flex-wrap gap-2">
              ${upload(`banner-celular-${i}`, b.celular ? "Cambiar" : "Subir")}
              ${b.celular ? `<button type="button" class="${GHOST}" data-quitar-celular="${i}">Quitar</button>` : ""}
            </span>
          </span>
        </div>
        ${field({ id: `banner-alt-${i}`, label: "Descripción de la imagen", value: b.alt, max: 200 })}
      </div>
    </div>
  </li>`;

const htmlPrincipal = (p: Principal) => `
  <section aria-labelledby="carrusel-banners">
    <h3 id="carrusel-banners" class="m-0 mb-1 font-sans text-[1rem] font-bold">Banners</h3>
    <p class="${HINT} mb-3">Hasta ${MAX_BANNERS} · 2000 × 761 px · ${LIMITE}</p>
    <ol class="m-0 flex list-none flex-col gap-3 p-0">${p.banners.map((b, i) => tarjetaBanner(b, i, p.banners.length)).join("")}</ol>
    ${p.banners.length < MAX_BANNERS ? `<div class="mt-3">${upload("banners-nuevos", "Añadir banners", true)}</div>` : ""}
  </section>
  <section aria-labelledby="carrusel-retrato" class="mt-6 border-t border-t-base-300 pt-5">
    <h3 id="carrusel-retrato" class="m-0 mb-1 font-sans text-[1rem] font-bold">Retrato de la segunda diapositiva</h3>
    <p class="${HINT} mb-3">1200 × 1200 px · ${LIMITE}</p>
    <div class="flex flex-wrap items-end gap-3 rounded-[3px] border border-base-300 p-3">
      <img src="${miniatura(p.retrato.imagen)}" alt="" class="aspect-square w-[104px] rounded-[3px] bg-base-200 object-cover" />
      <span class="pb-0.5">${upload("retrato-nuevo", "Cambiar retrato")}</span>
      <div class="basis-full">${field({ id: "retrato-alt", label: "Descripción de la imagen", value: p.retrato.alt, max: 200 })}</div>
    </div>
  </section>`;

const htmlPiezas = (p: Piezas) => `
  <p class="${HINT} mt-0 mb-3">Hasta ${MAX_PIEZAS} · 1080 × 1350 px · ${LIMITE}</p>
  <ol class="m-0 flex list-none flex-col gap-3 p-0">${p.piezas.map((x, i) => `
    <li class="flex gap-3 rounded-[3px] border border-base-300 p-3">
      <img src="${miniatura(x.imagen)}" alt="" class="aspect-[4/5] w-[104px] shrink-0 self-start rounded-[3px] bg-secondary object-contain max-mobile:w-[72px]" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <strong class="text-[0.85rem]">Pieza ${i + 1}</strong>
          <span class="flex">${moveButtons("pieza", i, p.piezas.length, `pieza ${i + 1}`, 1)}</span>
        </div>
        ${field({ id: `pieza-alt-${i}`, label: "Descripción de la imagen", value: x.alt, max: 200 })}
      </div>
    </li>`).join("")}</ol>
  ${p.piezas.length < MAX_PIEZAS ? `<div class="mt-3">${upload("piezas-nuevas", "Añadir piezas", true)}</div>` : ""}`;

const dialogo = document.createElement("div");
dialogo.className = "fixed inset-0 z-[950] flex items-center justify-center bg-[#06317659] p-4 max-tablet:items-end max-tablet:p-0";
dialogo.hidden = true;
dialogo.innerHTML = `
  <div role="dialog" aria-modal="true" aria-labelledby="carrusel-titulo"
    class="flex max-h-[min(92dvh,900px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[12px] border-t-4 border-t-secondary bg-base-100 text-primary [box-shadow:0_20px_50px_#06317640] max-tablet:max-w-none max-tablet:rounded-b-none">
    <div class="flex items-center justify-between gap-3 border-b border-b-base-300 px-6 py-3 max-tablet:px-4">
      <strong id="carrusel-titulo" class="flex items-center gap-2 text-[1rem]"></strong>
      <button type="button" data-cerrar class="${ICON_BUTTON}" aria-label="Cerrar">${iconSvg("close", 20)}</button>
    </div>
    <div data-cuerpo class="overflow-y-auto overscroll-contain px-6 py-5 max-tablet:px-4"></div>
    <div class="flex justify-end gap-2.5 border-t border-t-base-300 px-6 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] max-tablet:px-4">
      <button type="button" data-cerrar class="${GHOST} max-tablet:flex-1">Cancelar</button>
      <button type="button" data-guardar class="${BUTTON} bg-primary text-primary-content disabled:bg-[#d5dbe3] disabled:text-[#50617d] max-tablet:flex-1">Guardar borrador</button>
    </div>
  </div>`;
const guardar = dialogo.querySelector<HTMLButtonElement>("[data-guardar]")!;
const ventana = dialogo.querySelector<HTMLElement>("[role=dialog]")!;

let abierto: { cual: Carrusel; trabajo: Principal | Piezas; origen: HTMLElement; cuerpo: HTMLElement; comprobar: () => void } | null = null;
let subiendo = false;

/** Pasa lo escrito al trabajo; un campo que todavía no está pintado conserva su valor. */
function capturar() {
  if (!abierto) return;
  const valor = (id: string, antes: string) => abierto!.cuerpo.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? antes;
  if (abierto.cual === "principal") {
    const t = abierto.trabajo as Principal;
    t.banners.forEach((b, i) => { b.alt = valor(`banner-alt-${i}`, b.alt); });
    t.retrato.alt = valor("retrato-alt", t.retrato.alt);
  } else (abierto.trabajo as Piezas).piezas.forEach((x, i) => { x.alt = valor(`pieza-alt-${i}`, x.alt); });
}

/** Una por una; se detiene en la primera que no se puede subir. Ninguna se muestra antes de que el backend la procese. */
async function subirFotos(archivos: File[]) {
  const subidas = [];
  subiendo = true;
  guardar.disabled = true;
  abierto?.cuerpo.querySelectorAll<HTMLInputElement>("input[type=file]").forEach((x) => { x.disabled = true; });
  const terminarCarga = mostrarCarga(ventana, "Subiendo…");
  try {
    for (const [i, archivo] of archivos.entries()) {
      const medidas = await medidasArchivo(archivo);
      if (medidas && medidas.ancho * medidas.alto > MAX_PIXELES) throw new Error(avisoMegapixeles(medidas.ancho * medidas.alto));
      opciones.avisar(archivos.length > 1 ? `Subiendo imagen ${i + 1} de ${archivos.length}…` : "Subiendo imagen…");
      subidas.push(await adminApi.upload(archivo));
    }
  } catch (error) {
    opciones.avisar(error instanceof Error ? error.message : "No se pudo subir la imagen.", true);
  } finally {
    subiendo = false;
    terminarCarga();
  }
  return subidas;
}

function pintar() {
  const a = abierto!;
  const lista: unknown[] = a.cual === "principal" ? (a.trabajo as Principal).banners : (a.trabajo as Piezas).piezas;
  a.cuerpo.innerHTML = a.cual === "principal" ? htmlPrincipal(a.trabajo as Principal) : htmlPiezas(a.trabajo as Piezas);
  a.cuerpo.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((b) => b.addEventListener("click", () => {
    capturar();
    const i = Number(b.dataset.index), j = i + Number(b.dataset.step);
    [lista[i], lista[j]] = [lista[j], lista[i]];
    pintar();
    a.cuerpo.querySelector<HTMLButtonElement>(`[data-move][data-index="${j}"][data-step="${b.dataset.step}"]:not(:disabled)`)?.focus();
  }));
  a.cuerpo.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((b) => b.addEventListener("click", () => {
    capturar();
    lista.splice(Number(b.dataset.index), 1);
    pintar();
  }));
  a.cuerpo.querySelectorAll<HTMLButtonElement>("[data-quitar-celular]").forEach((b) => b.addEventListener("click", () => {
    capturar();
    (a.trabajo as Principal).banners[Number(b.dataset.quitarCelular)].celular = null;
    pintar();
  }));
  const alElegir = (id: string, maximo: number, poner: (fotos: Awaited<ReturnType<typeof subirFotos>>) => void) =>
    a.cuerpo.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("change", async (e) => {
      const archivos = [...((e.target as HTMLInputElement).files ?? [])].slice(0, maximo);
      if (!archivos.length || subiendo) return;
      capturar();
      const fotos = await subirFotos(archivos);
      if (abierto !== a) return;
      // Lo escrito mientras se subía se conserva al volver a pintar.
      capturar();
      if (fotos.length) poner(fotos);
      pintar();
      if (fotos.length === archivos.length)
        opciones.avisar(fotos.length === 1 ? "Imagen subida. Describe la imagen y guarda el borrador." : "Imágenes subidas. Describe cada una y guarda el borrador.");
    });
  if (a.cual === "principal") {
    const t = a.trabajo as Principal;
    alElegir("banners-nuevos", MAX_BANNERS - t.banners.length, (fotos) => t.banners.push(...fotos.map((foto) => ({ imagen: { foto }, celular: null, alt: "" }))));
    alElegir("retrato-nuevo", 1, ([foto]) => { t.retrato = { imagen: { foto }, alt: "" }; });
    t.banners.forEach((_, i) => alElegir(`banner-celular-${i}`, 1, ([foto]) => { t.banners[i].celular = foto; }));
  } else {
    const t = a.trabajo as Piezas;
    alElegir("piezas-nuevas", MAX_PIEZAS - t.piezas.length, (fotos) => t.piezas.push(...fotos.map((foto) => ({ imagen: { foto }, alt: "" }))));
  }
  a.comprobar();
}

function abrir(cual: Carrusel, origen: HTMLElement) {
  const trabajo = structuredClone(borrador[cual]);
  const cuerpo = document.createElement("div");
  cuerpo.className = "overflow-y-auto overscroll-contain px-6 py-5 max-tablet:px-4";
  dialogo.querySelector("[data-cuerpo]")!.replaceWith(cuerpo);
  cuerpo.dataset.cuerpo = "";
  abierto = { cual, trabajo, origen, cuerpo, comprobar: () => {} };
  abierto.comprobar = vigilarCambios(cuerpo, guardar, borrador[cual], () => { capturar(); return trabajo; });
  dialogo.querySelector("#carrusel-titulo")!.innerHTML = `${iconSvg("image", 20)} ${NOMBRES[cual]}`;
  pintar();
  dialogo.hidden = false;
  document.documentElement.style.overflow = "hidden";
  dialogo.querySelector<HTMLElement>("[data-cerrar]")!.focus();
}

function cerrar() {
  const origen = abierto?.origen;
  abierto = null;
  dialogo.hidden = true;
  document.documentElement.style.overflow = "";
  origen?.focus();
}

dialogo.addEventListener("click", (e) => {
  if (e.target === dialogo || (e.target as Element).closest("[data-cerrar]")) cerrar();
});
dialogo.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrar();
  if (e.key === "Tab") {
    const items = [...dialogo.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")]
      .filter((x) => x.checkVisibility() || (x as HTMLInputElement).type === "file");
    const [primero, ultimo] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }
});
guardar.addEventListener("click", () => void bloquearMientras(guardar, async () => {
  capturar();
  const a = abierto!;
  const faltan = a.cual === "principal"
    ? [...(a.trabajo as Principal).banners.map((b, i) => [`banner-alt-${i}`, b.alt]), ["retrato-alt", (a.trabajo as Principal).retrato.alt]]
    : (a.trabajo as Piezas).piezas.map((x, i) => [`pieza-alt-${i}`, x.alt]);
  const vacia = faltan.find(([, alt]) => !alt);
  if (vacia) {
    opciones.avisar("Describe cada imagen antes de guardar.", true);
    a.cuerpo.querySelector<HTMLInputElement>(`#${vacia[0]}`)?.focus();
    return;
  }
  const terminarCarga = mostrarCarga(ventana, "Guardando…");
  try {
    if (a.cual === "principal") {
      const t = a.trabajo as Principal;
      await adminApi.saveHomeMain({
        banners: t.banners.map((b) => ({ imagen: cuerpoImagen(b.imagen), celular: b.celular?.idMedio ?? null, alt: b.alt })),
        retrato: { imagen: cuerpoImagen(t.retrato.imagen), alt: t.retrato.alt },
      }, versiones[a.cual] ?? null);
    } else {
      await adminApi.saveHomePieces({ piezas: (a.trabajo as Piezas).piezas.map((x) => ({ imagen: cuerpoImagen(x.imagen), alt: x.alt })) }, versiones[a.cual] ?? null);
    }
    const draft = await adminApi.draft();
    borrador = draft.inicio;
    versiones = draft.versiones.inicio;
  } catch (error) {
    opciones.avisar(error instanceof Error ? error.message : "No se pudo guardar.", true);
    return;
  } finally {
    terminarCarga();
  }
  cerrar();
  pintarBorrador();
  await opciones.alGuardar();
  opciones.avisar("Guardado como borrador. Publica para que se vea en el sitio.");
}));

function ponerImagen(img: HTMLImageElement, imagen: DraftHomeImage, alt: string, sizes: string, tope = false) {
  const version = "foto" in imagen ? { src: uploadedUrl(imagen.foto, imagen.foto.anchos.at(-1)!), srcset: uploadedSrcset(imagen.foto) } : originales[imagen.original];
  img.srcset = version.srcset;
  img.sizes = sizes;
  img.src = version.src;
  img.alt = alt;
  img.decoding = "async";
  img.removeAttribute("width");
  img.removeAttribute("height");
  const conTope = tope && "foto" in imagen;
  TOPE.forEach((c) => img.classList.toggle(c, conTope));
  if (conTope) img.style.cssText = medidasFoto(imagen.foto);
  else img.removeAttribute("style");
}

function puntos(grupo: HTMLElement, selector: string, total: number, nombre: string) {
  const actuales = [...grupo.querySelectorAll<HTMLElement>(selector)];
  actuales.slice(1).forEach((x) => x.remove());
  const lista = Array.from({ length: total }, (_, i) => {
    const punto = i ? (actuales[0].cloneNode() as HTMLElement) : actuales[0];
    punto.classList.toggle("is-active", !i);
    punto.setAttribute("aria-current", String(!i));
    punto.setAttribute("aria-label", `Ver ${nombre} ${i + 1}`);
    return punto;
  });
  actuales[0].after(...lista.slice(1));
}

function pintarBorrador() {
  const { banners, retrato } = borrador.principal;
  const segunda = [...hero.querySelectorAll<HTMLElement>("[data-slide]")].at(-1)!;
  hero.querySelectorAll<HTMLElement>("[data-slide]").forEach((s) => { if (s !== segunda) s.remove(); });
  const total = banners.length + 1;
  const nuevas = banners.map((b, i) => {
    const slide = plantilla.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const img = slide.querySelector("img")!;
    ponerImagen(img, b.imagen, b.alt, "100vw");
    img.loading = i ? "lazy" : "eager";
    if (b.celular) {
      const picture = document.createElement("picture");
      picture.className = "contents";
      const source = document.createElement("source");
      source.media = "(width <= 760px)";
      source.srcset = uploadedSrcset(b.celular);
      source.sizes = "100vw";
      img.replaceWith(picture);
      picture.append(source, img);
      slide.querySelector(":scope > div")?.remove();
    }
    slide.dataset.slide = String(i);
    slide.setAttribute("aria-label", `${i + 1} de ${total}`);
    slide.hidden = i > 0;
    opciones.decorar(slide);
    return slide;
  });
  segunda.before(...nuevas);
  segunda.dataset.slide = String(banners.length);
  segunda.setAttribute("aria-label", `${total} de ${total}`);
  segunda.hidden = true;
  ponerImagen(segunda.querySelector("img")!, retrato.imagen, retrato.alt, "(max-width: 760px) 49vw, 47vw");
  puntos(hero.querySelector<HTMLElement>(".carousel-controls [role=group]")!, ".slide-dot", total, "diapositiva");

  const { piezas } = borrador.piezas;
  const actuales = [...perfil.querySelectorAll<HTMLImageElement>("[data-profile-image]")];
  const modelo = actuales[0].cloneNode() as HTMLImageElement;
  const imagenes = piezas.map((p, i) => {
    const img = modelo.cloneNode() as HTMLImageElement;
    ponerImagen(img, p.imagen, p.alt, "(max-width: 760px) 90vw, 40vw", true);
    img.dataset.profileImage = String(i);
    img.classList.toggle("is-active", !i);
    img.hidden = i > 0;
    return img;
  });
  actuales.forEach((x) => x.remove());
  perfil.prepend(...imagenes);
  const grupo = perfil.querySelector<HTMLElement>(".profile-dots")!;
  puntos(grupo, ".profile-dot", piezas.length, "imagen");
  grupo.hidden = piezas.length < 2;
  document.dispatchEvent(new Event("carruseles:cambiados"));
}

const botones = (["principal", "piezas"] as const).map((cual) => {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.dataset.editarCarrusel = cual;
  boton.className = "absolute top-4 right-4 z-[6] inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-accent bg-primary px-4 text-[0.82rem] font-bold text-primary-content [box-shadow:0_6px_18px_#06317666] hover:bg-neutral focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent max-tablet:top-2.5 max-tablet:right-2.5 max-tablet:px-3.5";
  boton.innerHTML = `${iconSvg("image", 18)}<span>Cambiar imágenes</span>`;
  boton.setAttribute("aria-label", `Cambiar las imágenes del ${NOMBRES[cual].toLowerCase()}`);
  boton.addEventListener("click", () => abrir(cual, boton));
  return boton;
});

export function iniciarCarruseles(o: Opciones) {
  opciones = o;
  document.body.append(dialogo);
}

export function mostrarCarruseles(draft: Pick<Draft, "inicio" | "versiones">) {
  borrador = draft.inicio;
  versiones = draft.versiones.inicio;
  pintarBorrador();
  hero.append(botones[0]);
  perfil.append(botones[1]);
}

export function ocultarCarruseles() {
  if (abierto) cerrar();
  hero.innerHTML = publicado.hero;
  perfil.innerHTML = publicado.perfil;
  document.dispatchEvent(new Event("carruseles:cambiados"));
}
