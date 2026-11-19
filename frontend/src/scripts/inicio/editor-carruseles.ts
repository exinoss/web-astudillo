// Lo carga modo-edicion.ts antes de pintar los textos del borrador: `publicado` guarda la portada tal como se publicó.
import { AVISO_ENLACE_BOTON, AVISO_HORIZONTAL, enlaceBoton, MAX_BANNERS, MAX_FOTOS_EQUIPO, MAX_IMAGENES_PIEZAS, MAX_VIDEOS_PIEZAS, type Carrusel, type Original } from "../../../../backend/src/contracts/inicio";
import { MAX_ENLACE_RED } from "../../../../backend/src/contracts/redes";
import { LARGOS } from "../../../../backend/src/contracts/limites";
import { MAX_MB_FOTO } from "../../../../backend/src/contracts/media";
import { mostrarCarga } from "../../lib/comun/animaciones";
import { medidasArchivo } from "../../lib/comun/foto-local";
import { imageView, medidasFoto, uploadedSrcset, uploadedUrl, type ImageView } from "../../lib/comun/fotos";
import { esc } from "../../lib/comun/html";
import { iconSvg } from "../../lib/comun/iconos";
import { campoEnlace, campoFormato, campoPortada, comprobarEnlace } from "../../lib/cuenta/panel/campos-video";
import { piezaVideo } from "../../lib/inicio/pieza-video";
import { AVISO_GUARDANDO, bloquearMientras, vigilarCambios } from "../../lib/comun/cambios";
import { desmarcarAlEscribir, marcarVacios } from "../../lib/comun/campos";
import { BOLA, DANGER, enlazarLista, field, GHOST, HINT, ICON_BUTTON, INTERRUPTOR, LABEL, moveButtons, PISTA, PRINCIPAL, thumb, upload } from "../../lib/cuenta/panel/campos";
import { opcionesDePagina } from "../../lib/cuenta/panel/paginas";
import { atributosBoton, RETRATO } from "../../lib/inicio/segunda-diapositiva";
import { adminApi, type Draft, type DraftHomeCarousels, type DraftHomeImage, type DraftHomeVideo, type HomeImageBody } from "../../lib/data/http/admin-api";

type Principal = DraftHomeCarousels["principal"];
type Piezas = DraftHomeCarousels["piezas"];
type Equipo = DraftHomeCarousels["equipo"];
type Version = { src: string; srcset: string; miniatura: string };
type Sitio = Pick<Draft, "inicio" | "versiones" | "textos" | "originales" | "propuestas">;
interface Opciones {
  avisar: (mensaje: string, error?: boolean) => void;
  alGuardar: () => Promise<void>;
  /** Prepara para editar los textos de una diapositiva nueva, como los que ya estaban al activar el modo. */
  decorar: (raiz: ParentNode) => void;
}

const LIMITE = `Máximo ${MAX_MB_FOTO} MB.`;
// Mismas clases que index.astro: una pieza subida no se ve más grande que su archivo.
const TOPE = ["m-auto", "max-h-[calc(var(--ancho-foto)/var(--proporcion))]", "max-w-(--ancho-foto)"];
const NOMBRES: Record<Carrusel, string> = { principal: "Carrusel principal", piezas: "Carrusel de piezas", equipo: "Carrusel del equipo" };

const hero = document.querySelector<HTMLElement>('[data-carrusel-editable="principal"]')!;
const perfil = document.querySelector<HTMLElement>('[data-carrusel-editable="piezas"]')!;
const originales = JSON.parse(hero.dataset.originales!) as Record<Original, Version>;
const portadas = JSON.parse(perfil.dataset.portadas!) as Record<"horizontal" | "vertical", ImageView>;
const plantilla = hero.querySelector<HTMLTemplateElement>("template[data-plantilla-banner]")!;
const publicado = { hero: hero.innerHTML, perfil: perfil.innerHTML };
const seccionEquipo = document.querySelector<HTMLElement>('[data-carrusel-editable="equipo"]')!;
const equipo = seccionEquipo.querySelector<HTMLElement>("[data-carrusel]")!;
const plantillaEquipo = equipo.querySelector<HTMLTemplateElement>("template[data-plantilla-equipo]")!;
const controlesEquipo = equipo.querySelector<HTMLElement>("[data-controles]")!;
// Las fotos publicadas se apartan sin copiarlas: así conservan el visor que ya tienen montado.
const fotosPublicadas = [...equipo.querySelectorAll<HTMLElement>("[data-diapositiva]")];
const sinFotos = document.createElement("div");
sinFotos.className = "flex min-h-[180px] flex-col items-center justify-center gap-3 border-y-2 border-dashed border-neutral bg-primary-soft px-5 py-6 text-center";
sinFotos.innerHTML = `<p class="m-0 text-[0.9rem] text-primary"><strong>Carrusel del equipo</strong> · Aún no tiene imágenes y no se muestra en el sitio.</p>`;

let opciones: Opciones;
let borrador: DraftHomeCarousels;
let sitio: Sitio;
let versiones: Draft["versiones"]["inicio"] = {};

/** Miniatura de una imagen del borrador: la foto subida o la original del sitio. */
const miniatura = (imagen: DraftHomeImage) => ("foto" in imagen ? thumb(imagen.foto) : originales[imagen.original].miniatura);
/** Lo que se envía a la API por cada imagen: el id de la foto subida o el nombre de la original. */
const cuerpoImagen = (imagen: DraftHomeImage): HomeImageBody => ("foto" in imagen ? { idMedio: imagen.foto.idMedio } : { original: imagen.original });

/** Tarjeta de un banner en el editor, con su imagen, la de celular y sus botones. */
const tarjetaBanner = (b: Principal["banners"][number], i: number, total: number) => `
  <li class="flex flex-col gap-3 rounded-control border border-base-300 p-3">
    <div class="flex items-center justify-between gap-2">
      <strong class="text-[0.85rem]">Banner ${i + 1}</strong>
      <span class="flex">${moveButtons("banner", i, total, `banner ${i + 1}`, 0, 1)}</span>
    </div>
    <div class="grid grid-cols-[minmax(0,260px)_minmax(0,1fr)] items-start gap-4 max-tablet:grid-cols-1">
      <img src="${miniatura(b.imagen)}" alt="" class="aspect-[1947/741] w-full rounded-control bg-base-200 object-cover" />
      <div class="flex flex-col gap-3">
        ${i === 0 ? `<p class="${HINT} mt-0">Este banner ya tiene su versión para celular.</p>` : `<div class="flex flex-wrap items-center gap-3">
          ${b.celular
            ? `<img src="${thumb(b.celular)}" alt="" class="aspect-[4/3] w-[104px] rounded-control bg-base-200 object-cover" />`
            : `<span class="grid aspect-[4/3] w-[104px] place-items-center rounded-control border border-dashed border-field-border px-2 text-center text-[0.68rem] leading-tight text-muted">Sin imagen para celular</span>`}
          <span class="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span class="text-[0.82rem] font-bold">Imagen para celular <span class="font-normal">(opcional) · 1520 × 1140 px</span></span>
            <span class="flex flex-wrap gap-2">
              ${upload(`banner-celular-${i}`, b.celular ? "Cambiar" : "Subir")}
              ${b.celular ? `<button type="button" class="${DANGER}" data-quitar-celular="${i}">${iconSvg("trash", 18)} Quitar</button>` : ""}
            </span>
          </span>
        </div>`}
        ${field({ id: `banner-alt-${i}`, label: "Descripción de la imagen", value: b.alt, max: LARGOS.descripcionFoto, required: true })}
      </div>
    </div>
  </li>`;

/** Contenido del editor del carrusel principal: banners y retrato. */
const htmlPrincipal = (p: Principal) => `
  <section aria-labelledby="carrusel-banners">
    <h3 id="carrusel-banners" class="m-0 mb-1 font-sans text-[1rem] font-bold">Banners</h3>
    <p class="${HINT} mb-3">Hasta ${MAX_BANNERS} · 2000 × 761 px · ${LIMITE}</p>
    <ol class="m-0 flex list-none flex-col gap-3 p-0">${p.banners.map((b, i) => tarjetaBanner(b, i, p.banners.length)).join("")}</ol>
    ${p.banners.length < MAX_BANNERS ? `<div class="mt-3">${upload("banners-nuevos", "Añadir banners", true)}</div>` : ""}
  </section>
  <section aria-labelledby="carrusel-retrato" class="mt-6 border-t border-t-base-300 pt-5">
    <h3 id="carrusel-retrato" class="m-0 mb-1 font-sans text-[1rem] font-bold">Segunda diapositiva</h3>
    <p class="${HINT} mb-3">Retrato: 1200 × 1200 px · ${LIMITE}</p>
    <div class="flex flex-col gap-4 rounded-control border border-base-300 p-3">
      <div class="flex gap-3 max-mobile:flex-col">
        <img src="${miniatura(p.retrato.imagen)}" alt="" class="aspect-square w-[104px] rounded-control bg-base-200 object-cover" />
        <div class="flex min-w-0 flex-1 flex-col items-start gap-3">${upload("retrato-nuevo", "Cambiar retrato")}<div class="w-full">${field({ id: "retrato-alt", label: "Descripción de la imagen", value: p.retrato.alt, max: LARGOS.descripcionFoto, required: true })}</div></div>
      </div>
      ${destinoBoton(p.enlace, abierto?.externo ?? false)}
    </div>
  </section>`;

/** Interruptor, selector de página y campo de enlace externo del botón de la segunda diapositiva. */
const destinoBoton = (enlace: string, externo: boolean) => `
  <div role="group" aria-labelledby="boton-destino" class="flex flex-col gap-3">
    <span id="boton-destino" class="${LABEL}">¿A dónde lleva el botón?</span>
    <button type="button" data-destino role="switch" aria-checked="${externo}" aria-label="Enlace externo" class="${INTERRUPTOR} self-start whitespace-nowrap">
      <span data-lado="pagina" aria-hidden="true" class="${externo ? "text-muted" : "font-bold"}">Página del sitio</span>
      <span data-pista class="${PISTA} bg-primary${externo ? " justify-end" : ""}"><span class="${BOLA} bg-primary-content"></span></span>
      <span data-lado="externo" aria-hidden="true" class="${externo ? "font-bold" : "text-muted"}">Enlace externo</span>
    </button>
    <div data-panel="pagina" ${externo ? "hidden" : ""}>
      <label for="boton-pagina" class="${LABEL}">Página</label>
      <select id="boton-pagina" class="campo">${opcionesDePagina(sitio, externo ? null : enlace || null)}</select>
      <p class="${HINT}">Con «Sin enlace», el botón se ve apagado. Su texto se cambia en la diapositiva.</p>
    </div>
    <div data-panel="externo" ${externo ? "" : "hidden"}>${field({ id: "boton-url", label: "Enlace", value: externo ? enlace : "", max: MAX_ENLACE_RED,
      hint: "De Facebook, TikTok, Instagram o YouTube, por ejemplo https://www.facebook.com/watch/?v=… Su texto se cambia en la diapositiva." })}</div>
  </div>`;

/** Portada de un video del borrador: la suya o la imagen de la campaña en su formato. */
const portadaVideo = (v: DraftHomeVideo): ImageView => (v.portada ? imageView(v.portada) : portadas[v.vertical ? "vertical" : "horizontal"]);
/** Cuántos videos hay entre las piezas. */
const cuantosVideos = (p: Piezas) => p.piezas.filter((x) => "video" in x).length;

/** Campos de una pieza del editor: la descripción de una imagen o el título, enlace, formato y portada de un video. */
const camposPieza = (x: Piezas["piezas"][number], i: number) => ("video" in x
  ? `${field({ id: `video-titulo-${i}`, label: "Título del video", value: x.video.titulo, max: LARGOS.acercaDeCarlos.tituloVideo, required: true })}
        ${campoEnlace(i, x.video.enlace)}
        ${campoFormato(i, x.video.vertical)}
        ${campoPortada(i, x.video.portada, false)}`
  : field({ id: `pieza-alt-${i}`, label: "Descripción de la imagen", value: x.alt, max: LARGOS.descripcionFoto, required: true }));

/** Contenido del editor del carrusel de piezas: imágenes y videos en el orden en que se muestran. */
const htmlPiezas = (p: Piezas) => `
  <p class="${HINT} mt-0 mb-3">Hasta ${MAX_IMAGENES_PIEZAS} imágenes y ${MAX_VIDEOS_PIEZAS} videos · imágenes de 1080 × 1350 px · ${LIMITE}</p>
  <ol class="m-0 flex list-none flex-col gap-3 p-0">${p.piezas.map((x, i) => {
    const nombre = `${"video" in x ? "Video" : "Imagen"} ${i + 1}`;
    return `
    <li class="flex gap-3 rounded-control border border-base-300 p-3">
      <img src="${"video" in x ? esc(portadaVideo(x.video).src) : miniatura(x.imagen)}" alt="" class="aspect-[4/5] w-[104px] shrink-0 self-start rounded-control bg-secondary object-contain max-mobile:w-[72px]" />
      <div class="flex min-w-0 flex-1 flex-col ${"video" in x ? "gap-3" : "gap-2"}">
        <div class="flex items-center justify-between gap-2">
          <strong class="text-[0.85rem]">${nombre}</strong>
          <span class="flex">${moveButtons("pieza", i, p.piezas.length, nombre.toLowerCase(), 1)}</span>
        </div>
        ${camposPieza(x, i)}
      </div>
    </li>`;
  }).join("")}</ol>
  <div class="mt-3 flex flex-wrap gap-3">
    ${p.piezas.length - cuantosVideos(p) < MAX_IMAGENES_PIEZAS ? upload("piezas-nuevas", "Añadir imágenes", true) : ""}
    ${cuantosVideos(p) < MAX_VIDEOS_PIEZAS ? `<button type="button" data-anadir-video class="${GHOST}">${iconSvg("plus", 17)} Añadir video</button>` : ""}
  </div>
  <p class="${HINT}">Se muestran en este orden.</p>`;

/** Contenido del editor del carrusel del equipo. */
const htmlEquipo = (e: Equipo) => `
  <p class="${HINT} mt-0 mb-3">Hasta ${MAX_FOTOS_EQUIPO} · imágenes horizontales · 2000 × 761 px · ${LIMITE}</p>
  <ol class="m-0 flex list-none flex-col gap-3 p-0">${e.fotos.map((x, i) => `
    <li class="flex gap-3 rounded-control border border-base-300 p-3 max-mobile:flex-col">
      <img src="${thumb(x.foto)}" alt="" class="aspect-[1947/741] w-[200px] shrink-0 self-start rounded-control bg-accent object-contain max-mobile:w-full" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <strong class="text-[0.85rem]">Imagen ${i + 1}</strong>
          <span class="flex">${moveButtons("imagen", i, e.fotos.length, `imagen ${i + 1}`)}</span>
        </div>
        ${field({ id: `equipo-alt-${i}`, label: "Descripción de la imagen", value: x.alt, max: LARGOS.descripcionFoto, required: true })}
      </div>
    </li>`).join("")}</ol>
  ${e.fotos.length < MAX_FOTOS_EQUIPO ? `<div class="mt-3">${upload("equipo-nuevas", "Añadir imágenes", true)}</div>` : ""}`;

const dialogo = document.createElement("dialog");
dialogo.className = "fixed inset-0 m-0 size-auto max-h-none max-w-none items-center justify-center bg-velo p-4 backdrop:bg-transparent open:flex max-tablet:items-end max-tablet:p-0";
dialogo.setAttribute("aria-labelledby", "carrusel-titulo");
dialogo.innerHTML = `
  <div class="flex max-h-[min(92dvh,900px)] w-full max-w-[720px] flex-col overflow-hidden rounded-[12px] border-t-4 border-t-secondary bg-base-100 text-primary [box-shadow:0_20px_50px_#06317640] max-tablet:max-w-none max-tablet:rounded-b-none">
    <div class="flex items-center justify-between gap-3 border-b border-b-base-300 px-6 py-3 max-tablet:px-4">
      <strong id="carrusel-titulo" class="flex items-center gap-2 text-[1rem]"></strong>
      <button type="button" data-cerrar class="${ICON_BUTTON}" aria-label="Cerrar">${iconSvg("close", 20)}</button>
    </div>
    <div data-cuerpo class="overflow-y-auto overscroll-contain px-6 py-5 max-tablet:px-4"></div>
    <div class="flex justify-end gap-2.5 border-t border-t-base-300 px-6 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] max-tablet:px-4">
      <button type="button" data-cerrar class="${GHOST} max-tablet:flex-1">Cancelar</button>
      <button type="button" data-guardar class="${PRINCIPAL} max-tablet:flex-1">Guardar borrador</button>
    </div>
  </div>`;
const guardar = dialogo.querySelector<HTMLButtonElement>("[data-guardar]")!;
const ventana = dialogo.firstElementChild as HTMLElement;

let abierto: { cual: Carrusel; trabajo: Principal | Piezas | Equipo; origen: HTMLElement; cuerpo: HTMLElement; comprobar: () => void; externo: boolean } | null = null;
let subiendo = false;

/** Pasa lo escrito al trabajo; un campo que todavía no está pintado conserva su valor. */
function capturar() {
  if (!abierto) return;
  const valor = (id: string, antes: string) => abierto!.cuerpo.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? antes;
  if (abierto.cual === "principal") {
    const t = abierto.trabajo as Principal;
    t.banners.forEach((b, i) => { b.alt = valor(`banner-alt-${i}`, b.alt); });
    t.retrato.alt = valor("retrato-alt", t.retrato.alt);
    t.enlace = valor(abierto.externo ? "boton-url" : "boton-pagina", t.enlace);
  } else if (abierto.cual === "piezas") (abierto.trabajo as Piezas).piezas.forEach((x, i) => {
    if (!("video" in x)) { x.alt = valor(`pieza-alt-${i}`, x.alt); return; }
    x.video.titulo = valor(`video-titulo-${i}`, x.video.titulo);
    x.video.enlace = valor(`video-enlace-${i}`, x.video.enlace);
    const formato = abierto!.cuerpo.querySelector<HTMLInputElement>(`[name="video-formato-${i}"]:checked`);
    if (formato) x.video.vertical = formato.value === "vertical";
  });
  else (abierto.trabajo as Equipo).fotos.forEach((x, i) => { x.alt = valor(`equipo-alt-${i}`, x.alt); });
}

/** Cambia el destino del botón entre una página del sitio y un enlace externo, sin perder lo escrito en el otro. */
function cambiarDestino(a: NonNullable<typeof abierto>, boton: HTMLButtonElement) {
  a.externo = !a.externo;
  boton.setAttribute("aria-checked", String(a.externo));
  boton.querySelector("[data-pista]")!.classList.toggle("justify-end", a.externo);
  const activo = a.externo ? "externo" : "pagina";
  boton.querySelectorAll<HTMLElement>("[data-lado]").forEach((x) => {
    x.classList.toggle("font-bold", x.dataset.lado === activo);
    x.classList.toggle("text-muted", x.dataset.lado !== activo);
  });
  a.cuerpo.querySelectorAll<HTMLElement>("[data-panel]").forEach((x) => { x.hidden = x.dataset.panel !== activo; });
  a.comprobar();
}

/** Por qué no se puede guardar el enlace del botón, o null si vale. */
function avisoEnlace(a: NonNullable<typeof abierto>) {
  const { enlace } = a.trabajo as Principal;
  if (a.externo && !enlace) return "Pega el enlace del botón o elige una página del sitio.";
  return enlaceBoton(enlace) === null ? AVISO_ENLACE_BOTON : null;
}

/** Una por una; se detiene en la primera que no se puede subir. Ninguna se muestra antes de que el backend la procese. */
async function subirAlEditor(archivos: File[], horizontales = false) {
  const subidas: Awaited<ReturnType<typeof adminApi.upload>>[] = [];
  // Con el bloqueo de `bloquearMientras`, escribir durante la subida no reactiva «Guardar» (`vigilarCambios` lo respeta).
  const empezo = await bloquearMientras(guardar, async () => {
    subiendo = true;
    abierto?.cuerpo.querySelectorAll<HTMLInputElement>("input[type=file]").forEach((x) => { x.disabled = true; });
    const terminarCarga = mostrarCarga(ventana, "Subiendo…");
    try {
      for (const [i, archivo] of archivos.entries()) {
        opciones.avisar(archivos.length > 1 ? `Subiendo imagen ${i + 1} de ${archivos.length}…` : "Subiendo imagen…");
        const medidas = horizontales ? await medidasArchivo(archivo) : null;
        if (medidas && medidas.ancho <= medidas.alto) throw new Error(AVISO_HORIZONTAL);
        subidas.push(await adminApi.upload(archivo));
      }
    } catch (error) {
      opciones.avisar(error instanceof Error ? error.message : "No se pudo subir la imagen.", true);
    } finally {
      subiendo = false;
      terminarCarga();
    }
  });
  if (!empezo) opciones.avisar(AVISO_GUARDANDO, true);
  return subidas;
}

/** Vuelve a dibujar el editor abierto y enlaza sus botones. */
function pintar() {
  const a = abierto!;
  const lista: unknown[] = a.cual === "principal" ? (a.trabajo as Principal).banners : a.cual === "piezas" ? (a.trabajo as Piezas).piezas : (a.trabajo as Equipo).fotos;
  a.cuerpo.innerHTML = a.cual === "principal" ? htmlPrincipal(a.trabajo as Principal) : a.cual === "piezas" ? htmlPiezas(a.trabajo as Piezas) : htmlEquipo(a.trabajo as Equipo);
  enlazarLista(a.cuerpo, () => lista, (mutar, movido) => {
    capturar();
    mutar();
    pintar();
    if (movido) a.cuerpo.querySelector<HTMLButtonElement>(`[data-move][data-index="${movido.indice}"][data-step="${movido.paso}"]:not(:disabled)`)?.focus();
  });
  a.cuerpo.querySelectorAll<HTMLButtonElement>("[data-quitar-celular]").forEach((b) => b.addEventListener("click", () => {
    capturar();
    (a.trabajo as Principal).banners[Number(b.dataset.quitarCelular)].celular = null;
    pintar();
  }));
  const alElegir = (id: string, maximo: number, poner: (fotos: Awaited<ReturnType<typeof subirAlEditor>>) => void, horizontales = false, listo = "") =>
    a.cuerpo.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener("change", async (e) => {
      const archivos = [...((e.target as HTMLInputElement).files ?? [])].slice(0, maximo);
      if (!archivos.length || subiendo) return;
      capturar();
      const fotos = await subirAlEditor(archivos, horizontales);
      if (abierto !== a) return;
      // Lo escrito mientras se subía se conserva al volver a pintar.
      capturar();
      if (fotos.length) poner(fotos);
      pintar();
      if (fotos.length === archivos.length)
        opciones.avisar(listo || (fotos.length === 1 ? "Imagen subida. Describe la imagen y guarda el borrador." : "Imágenes subidas. Describe cada una y guarda el borrador."));
    });
  if (a.cual === "principal") {
    const t = a.trabajo as Principal;
    alElegir("banners-nuevos", MAX_BANNERS - t.banners.length, (fotos) => t.banners.push(...fotos.map((foto) => ({ imagen: { foto }, celular: null, alt: "" }))));
    const altPintado = t.retrato.alt;
    // La descripción vieja no vale para la foto nueva, pero lo escrito mientras se subía se conserva.
    alElegir("retrato-nuevo", 1, ([foto]) => { t.retrato = { imagen: { foto }, alt: t.retrato.alt === altPintado ? "" : t.retrato.alt }; });
    t.banners.forEach((_, i) => alElegir(`banner-celular-${i}`, 1, ([foto]) => { t.banners[i].celular = foto; }));
    a.cuerpo.querySelector<HTMLButtonElement>("[data-destino]")!.addEventListener("click", (e) => cambiarDestino(a, e.currentTarget as HTMLButtonElement));
  } else if (a.cual === "piezas") {
    const t = a.trabajo as Piezas;
    alElegir("piezas-nuevas", MAX_IMAGENES_PIEZAS - (t.piezas.length - cuantosVideos(t)), (fotos) => t.piezas.push(...fotos.map((foto) => ({ imagen: { foto }, alt: "" }))));
    a.cuerpo.querySelector("[data-anadir-video]")?.addEventListener("click", () => {
      capturar();
      t.piezas.push({ video: { titulo: "", enlace: "", vertical: false, portada: null } });
      pintar();
      a.cuerpo.querySelector<HTMLInputElement>(`#video-titulo-${t.piezas.length - 1}`)?.focus();
    });
    t.piezas.forEach((x, i) => {
      if (!("video" in x)) return;
      enlazarVideo(a, x.video, i);
      alElegir(`video-portada-${i}`, 1, ([foto]) => { x.video.portada = foto; }, false, "Portada subida. Guarda el borrador para conservarla.");
    });
  } else {
    const t = a.trabajo as Equipo;
    alElegir("equipo-nuevas", MAX_FOTOS_EQUIPO - t.fotos.length, (fotos) => t.fotos.push(...fotos.map((foto) => ({ foto, alt: "" }))), true);
  }
  a.comprobar();
}

/** Enlaza los campos del video `i` del editor: comprueba su enlace y liga su portada a él. */
function enlazarVideo(a: NonNullable<typeof abierto>, video: DraftHomeVideo, i: number) {
  const input = a.cuerpo.querySelector<HTMLInputElement>(`#video-enlace-${i}`)!;
  const auto = a.cuerpo.querySelector<HTMLButtonElement>(`[data-video-cover-auto="${i}"]`)!;
  /** Vuelve a pintar el editor sin perder el campo que tenía el foco. */
  const repintar = () => {
    const id = document.activeElement?.id;
    pintar();
    if (id) a.cuerpo.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.focus({ preventScroll: true });
  };
  /** Pide a la plataforma la imagen del video y la pone de portada. */
  const traerPortada = (boton: HTMLButtonElement | null) => {
    const source = comprobarEnlace(a.cuerpo, i, false);
    if (!source || source.provider === "mp4") return;
    capturar();
    const enlace = video.enlace;
    /** Trae la imagen y la usa si el enlace sigue siendo el mismo. */
    const pedir = async () => {
      try {
        const foto = await adminApi.videoCover(enlace);
        // Si mientras tanto cambió el enlace o se cerró el editor, esta imagen ya no corresponde.
        if (abierto !== a || video.enlace !== enlace) return;
        video.portada = foto;
        repintar();
        opciones.avisar("Se usa la imagen del video como portada. Puedes cambiarla por otra.");
      } catch (error) {
        opciones.avisar(error instanceof Error ? error.message : "No se pudo traer la imagen del video.", true);
      }
    };
    void (boton ? bloquearMientras(boton, pedir) : pedir());
  };
  let enlaceDeLaPortada = input.value.trim();
  comprobarEnlace(a.cuerpo, i, false);
  input.addEventListener("input", () => comprobarEnlace(a.cuerpo, i, true));
  input.addEventListener("change", () => {
    if (input.value.trim() === enlaceDeLaPortada) return;
    enlaceDeLaPortada = input.value.trim();
    capturar();
    const habia = Boolean(video.portada);
    video.portada = null;
    traerPortada(null);
    if (habia) repintar();
  });
  auto.addEventListener("click", () => traerPortada(auto));
  a.cuerpo.querySelector(`[data-video-cover-remove="${i}"]`)?.addEventListener("click", () => {
    capturar();
    video.portada = null;
    pintar();
  });
}

/** Abre el editor de un carrusel con una copia de su borrador. */
function abrir(cual: Carrusel, origen: HTMLElement) {
  const trabajo = structuredClone(borrador[cual]);
  const cuerpo = document.createElement("div");
  cuerpo.className = "overflow-y-auto overscroll-contain px-6 py-5 max-tablet:px-4";
  dialogo.querySelector("[data-cuerpo]")!.replaceWith(cuerpo);
  cuerpo.dataset.cuerpo = "";
  desmarcarAlEscribir(cuerpo);
  const { enlace } = borrador.principal;
  abierto = { cual, trabajo, origen, cuerpo, comprobar: () => {}, externo: !!enlace && !enlace.startsWith("/") };
  abierto.comprobar = vigilarCambios(cuerpo, guardar, borrador[cual], () => { capturar(); return trabajo; });
  dialogo.querySelector("#carrusel-titulo")!.innerHTML = `${iconSvg("image", 20)} ${NOMBRES[cual]}`;
  pintar();
  dialogo.showModal();
  document.documentElement.style.overflow = "hidden";
  dialogo.querySelector<HTMLElement>("[data-cerrar]")!.focus();
}

/** Cierra el editor; el evento `close` (también con Esc) devuelve el foco al botón que lo abrió. */
function cerrar() {
  dialogo.close();
}

dialogo.addEventListener("close", () => {
  const origen = abierto?.origen;
  abierto = null;
  document.documentElement.style.overflow = "";
  origen?.focus();
});
dialogo.addEventListener("click", (e) => {
  if (e.target === dialogo || (e.target as Element).closest("[data-cerrar]")) cerrar();
});
guardar.addEventListener("click", () => void bloquearMientras(guardar, async () => {
  capturar();
  const a = abierto!;
  marcarVacios(a.cuerpo);
  if (a.cuerpo.querySelector('[aria-invalid="true"]')) {
    opciones.avisar(a.cual === "piezas" ? "Revisa los campos marcados antes de guardar." : "Describe cada imagen antes de guardar.", true);
    return;
  }
  const aviso = a.cual === "principal" ? avisoEnlace(a) : null;
  if (aviso) {
    a.cuerpo.querySelector("#boton-url")?.setAttribute("aria-invalid", "true");
    opciones.avisar(aviso, true);
    return;
  }
  const terminarCarga = mostrarCarga(ventana, "Guardando…");
  try {
    if (a.cual === "principal") {
      const t = a.trabajo as Principal;
      await adminApi.saveHomeMain({
        banners: t.banners.map((b) => ({ imagen: cuerpoImagen(b.imagen), celular: b.celular?.idMedio ?? null, alt: b.alt })),
        retrato: { imagen: cuerpoImagen(t.retrato.imagen), alt: t.retrato.alt },
        enlace: t.enlace,
      }, versiones[a.cual] ?? null);
    } else if (a.cual === "piezas") {
      await adminApi.saveHomePieces({ piezas: (a.trabajo as Piezas).piezas.map((x) => ("video" in x
        ? { video: { titulo: x.video.titulo, enlace: x.video.enlace, vertical: x.video.vertical, idPortada: x.video.portada?.idMedio ?? null } }
        : { imagen: cuerpoImagen(x.imagen), alt: x.alt })) }, versiones[a.cual] ?? null);
    } else {
      await adminApi.saveHomeTeam({ fotos: (a.trabajo as Equipo).fotos.map((x) => ({ idMedio: x.foto.idMedio, alt: x.alt })) }, versiones[a.cual] ?? null);
    }
    const draft = await adminApi.draft();
    borrador = draft.inicio;
    versiones = draft.versiones.inicio;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo guardar.";
    // La API nombra la pieza cuyo video no se puede mostrar («Pieza 2: …»): se marca su enlace.
    const pieza = Number(mensaje.match(/^Pieza (\d+):/)?.[1] ?? 0);
    if (pieza) a.cuerpo.querySelector(`#video-enlace-${pieza - 1}`)?.setAttribute("aria-invalid", "true");
    opciones.avisar(mensaje, true);
    return;
  } finally {
    terminarCarga();
  }
  cerrar();
  pintarBorrador();
  await opciones.alGuardar();
  opciones.avisar("Guardado como borrador. Publica para que se vea en el sitio.");
}));

/** Muestra en `img` una imagen del borrador con su srcset; con `tope`, no más grande que su archivo. */
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

/** Deja en `grupo` un punto por diapositiva, copiando el primero; `nombre` dice qué es cada diapositiva. */
function puntos(grupo: HTMLElement, selector: string, total: number, nombre: string | ((i: number) => string)) {
  const actuales = [...grupo.querySelectorAll<HTMLElement>(selector)];
  actuales.slice(1).forEach((x) => x.remove());
  const lista = Array.from({ length: total }, (_, i) => {
    const punto = i ? (actuales[0].cloneNode() as HTMLElement) : actuales[0];
    punto.classList.toggle("is-active", !i);
    punto.setAttribute("aria-current", String(!i));
    punto.setAttribute("aria-label", `Ver ${typeof nombre === "string" ? nombre : nombre(i)} ${i + 1}`);
    return punto;
  });
  actuales[0].after(...lista.slice(1));
}

/** Pinta en la portada los tres carruseles tal como están en el borrador. */
function pintarBorrador() {
  const { banners, retrato } = borrador.principal;
  const segunda = [...hero.querySelectorAll<HTMLElement>("[data-slide]")].at(-1)!;
  // El banner 1 es fijo: se conserva su diapositiva publicada, con su versión para celular y su zoom.
  const primera = hero.querySelector<HTMLElement>('[data-slide="0"]')!;
  hero.querySelectorAll<HTMLElement>("[data-slide]").forEach((s) => { if (s !== segunda && s !== primera) s.remove(); });
  const total = banners.length + 1;
  primera.querySelector("img")!.alt = banners[0].alt;
  primera.setAttribute("aria-label", `1 de ${total}`);
  primera.hidden = false;
  const nuevas = banners.slice(1).map((b, j) => {
    const i = j + 1;
    const slide = plantilla.content.firstElementChild!.cloneNode(true) as HTMLElement;
    const img = slide.querySelector("img")!;
    ponerImagen(img, b.imagen, b.alt, "100vw");
    img.loading = "lazy";
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
    slide.hidden = true;
    opciones.decorar(slide);
    return slide;
  });
  segunda.before(...nuevas);
  segunda.dataset.slide = String(banners.length);
  segunda.setAttribute("aria-label", `${total} de ${total}`);
  segunda.hidden = true;
  const imagenRetrato = segunda.querySelector("img")!;
  ponerImagen(imagenRetrato, retrato.imagen, retrato.alt, "(max-width: 760px) 49vw, 47vw");
  imagenRetrato.className = "foto" in retrato.imagen ? RETRATO.subido : RETRATO.original;
  if ("foto" in retrato.imagen) imagenRetrato.style.cssText = medidasFoto(retrato.imagen.foto);
  const enlace = segunda.querySelector<HTMLAnchorElement>("[data-boton-diapositiva]")!;
  ["href", "target", "rel", "aria-disabled"].forEach((x) => enlace.removeAttribute(x));
  Object.entries(atributosBoton(borrador.principal.enlace)).forEach(([x, v]) => enlace.setAttribute(x, v));
  puntos(hero.querySelector<HTMLElement>(".carousel-controls [role=group]")!, ".slide-dot", total, "diapositiva");

  const { piezas } = borrador.piezas;
  const diapositivas = piezas.map((p, i) => {
    if ("video" in p) {
      const plantillaVideo = document.createElement("template");
      plantillaVideo.innerHTML = piezaVideo({ title: p.video.titulo, url: p.video.enlace, vertical: p.video.vertical, cover: portadaVideo(p.video) }, i);
      return plantillaVideo.content.firstElementChild as HTMLElement;
    }
    const img = document.createElement("img");
    img.loading = "lazy";
    ponerImagen(img, p.imagen, p.alt, "(max-width: 760px) 90vw, 40vw", true);
    img.dataset.profileImage = String(i);
    img.classList.toggle("is-active", !i);
    img.hidden = i > 0;
    return img;
  });
  perfil.querySelectorAll("[data-profile-image]").forEach((x) => x.remove());
  perfil.prepend(...diapositivas);
  const grupo = perfil.querySelector<HTMLElement>(".profile-dots")!;
  puntos(grupo, ".profile-dot", piezas.length, (i) => ("video" in piezas[i] ? "video" : "imagen"));
  grupo.hidden = piezas.length < 2;

  const { fotos } = borrador.equipo;
  equipo.querySelectorAll("[data-diapositiva]").forEach((x) => x.remove());
  plantillaEquipo.before(...fotos.map(({ foto, alt }, i) => {
    const slide = plantillaEquipo.content.firstElementChild!.cloneNode(true) as HTMLElement;
    slide.style.cssText = medidasFoto(foto);
    ponerImagen(slide.querySelector("img")!, { foto }, alt, "100vw");
    slide.setAttribute("aria-label", `${i + 1} de ${fotos.length}`);
    slide.hidden = i > 0;
    return slide;
  }));
  puntos(controlesEquipo.querySelector<HTMLElement>("[role=group]")!, "[data-punto]", fotos.length, "imagen");
  controlesEquipo.hidden = fotos.length < 2;
  seccionEquipo.hidden = false;
  seccionEquipo.prepend(sinFotos);
  sinFotos.hidden = fotos.length > 0;
  const boton = botones[2];
  boton.classList.toggle("absolute", fotos.length > 0);
  boton.querySelector("span")!.textContent = fotos.length ? "Cambiar imágenes" : "Agregar imágenes";
  boton.setAttribute("aria-label", fotos.length ? "Cambiar las imágenes del carrusel del equipo" : "Agregar imágenes al carrusel del equipo");
  (fotos.length ? equipo : sinFotos).append(boton);
  document.dispatchEvent(new Event("carruseles:cambiados"));
}

const botones = (["principal", "piezas", "equipo"] as const).map((cual) => {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.dataset.editarCarrusel = cual;
  boton.className = "absolute top-4 right-4 z-[6] inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-accent bg-primary px-4 text-[0.82rem] font-bold text-primary-content [box-shadow:0_6px_18px_#06317666] hover:bg-neutral focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent max-tablet:top-2.5 max-tablet:right-2.5 max-tablet:px-3.5";
  const que = cual === "piezas" ? "imágenes y videos" : "imágenes";
  boton.innerHTML = `${iconSvg("image", 18)}<span>Cambiar ${que}</span>`;
  boton.setAttribute("aria-label", `Cambiar las ${que} del ${NOMBRES[cual].toLowerCase()}`);
  boton.addEventListener("click", () => abrir(cual, boton));
  return boton;
});

/** Guarda las opciones del modo edición y añade el diálogo del editor a la página. */
export function iniciarCarruseles(o: Opciones) {
  opciones = o;
  document.body.append(dialogo);
}

/** Muestra el borrador en la portada y los botones «Cambiar imágenes». */
export function mostrarCarruseles(draft: Sitio) {
  sitio = draft;
  borrador = draft.inicio;
  versiones = draft.versiones.inicio;
  pintarBorrador();
  hero.append(botones[0]);
  perfil.append(botones[1]);
}

/** Devuelve la portada a lo publicado y quita los botones del editor. */
export function ocultarCarruseles() {
  if (abierto) cerrar();
  hero.innerHTML = publicado.hero;
  perfil.innerHTML = publicado.perfil;
  equipo.querySelectorAll("[data-diapositiva]").forEach((x) => x.remove());
  plantillaEquipo.before(...fotosPublicadas);
  fotosPublicadas.forEach((x, i) => { x.hidden = i > 0; });
  puntos(controlesEquipo.querySelector<HTMLElement>("[role=group]")!, "[data-punto]", fotosPublicadas.length, "imagen");
  controlesEquipo.hidden = fotosPublicadas.length < 2;
  sinFotos.remove();
  botones[2].remove();
  seccionEquipo.hidden = !fotosPublicadas.length;
  document.dispatchEvent(new Event("carruseles:cambiados"));
}
