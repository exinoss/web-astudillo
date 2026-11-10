// La carga por URL permite reintentar; el navegador memoriza imports fallidos.
import visorUrl from "@google/model-viewer/dist/model-viewer.min.js?url";
import decodificadorUrl from "meshoptimizer/decoder?url";
import { reproducirEnHilo } from "../../lib/comun/animaciones";
import { alCambiarMovimiento, sinMovimiento } from "../../lib/comun/movimiento";
import { cargarScript, reintentable } from "../../lib/comun/carga-scripts";
import type { ModelViewerElement } from "@google/model-viewer";
import { activarRecorrido } from "../../lib/propuestas/recorrido";

const bloques = [...document.querySelectorAll<HTMLElement>(".model-3d")];

const cargarLibreria = reintentable(async (conReintento) => {
  const respuesta = await fetch(decodificadorUrl);
  if (!respuesta.ok) throw new Error(`decodificador: ${respuesta.status}`);
  // model-viewer espera un script clásico; se quita `export` y se sirve como Blob.
  // Con workers, la geometría se descomprime en paralelo y no bloquea la página.
  const hilos = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  const codigo = (await respuesta.text()).replace(
    "export { MeshoptDecoder };",
    `MeshoptDecoder.useWorkers(${hilos});`,
  );
  const url = URL.createObjectURL(
    new Blob([codigo], { type: "text/javascript" }),
  );
  // El decodificador debe configurarse antes de cargar model-viewer.
  (self as any).ModelViewerElement = { meshoptDecoderLocation: url };
  await cargarScript(conReintento(visorUrl), "module");
});

const html = document.documentElement;

const loaders = new WeakMap<HTMLElement, Promise<(() => void) | undefined>>();
/** Capa de carga sobre el póster; sin `porcentaje` no se muestra la barra. */
function avisar(bloque: HTMLElement, texto: string, aviso: string, porcentaje?: number) {
  const panel = bloque.querySelector<HTMLElement>(".model-3d-progreso")!;
  const pista = panel.querySelector<HTMLElement>(".model-3d-progreso-pista")!;
  const vivo = panel.querySelector(".model-3d-progreso-aviso")!;
  panel.querySelector(".model-3d-progreso-texto")!.textContent = texto;
  if (vivo.textContent !== aviso) vivo.textContent = aviso;
  pista.hidden = porcentaje === undefined;
  if (porcentaje !== undefined) {
    panel.querySelector<HTMLElement>(".model-3d-progreso-barra")!.style.width = `${porcentaje}%`;
    pista.setAttribute("aria-valuenow", String(porcentaje));
    pista.setAttribute("aria-valuetext", texto);
  }
  if (panel.hidden) {
    panel.hidden = false;
    // El Lottie normal se congelaría mientras el visor prepara el modelo y bloquea la página.
    loaders.set(bloque, reproducirEnHilo(panel.querySelector<HTMLElement>(".model-3d-progreso-loader")!, "loader"));
  }
}

/** Quita la capa de carga y detiene su animación. */
function ocultarAviso(bloque: HTMLElement) {
  bloque.querySelector<HTMLElement>(".model-3d-progreso")!.hidden = true;
  loaders.get(bloque)?.then((fin) => fin?.());
  loaders.delete(bloque);
}

/** Espera a que el loader esté en marcha: después, el visor puede bloquear la página. */
async function loaderEnPantalla(bloque: HTMLElement) {
  await Promise.race([loaders.get(bloque), new Promise((r) => setTimeout(r, 2000))]);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/** Carga model-viewer y pone el modelo en el bloque; si falla, ofrece reintentar. */
async function montar(bloque: HTMLElement, intentoModelo = 0, origen?: string) {
  // Como mostrarCarga: el loader solo aparece si la carga tarda más de 200 ms.
  const espera = setTimeout(() => avisar(bloque, "Cargando el modelo 3D…", "Cargando el modelo 3D"), 200);
  if ("pesado" in bloque.dataset) {
    avisar(bloque, "Cargando el modelo 3D…", "Cargando el modelo 3D");
    await loaderEnPantalla(bloque);
  }
  const terminar = () => {
    clearTimeout(espera);
    ocultarAviso(bloque);
  };
  try {
    await cargarLibreria();
  } catch (error) {
    console.error("No se pudo cargar el visor 3D:", error);
    terminar();
    ofrecerBoton(bloque, intentoModelo);
    return;
  }
  const contenedor = bloque.querySelector<HTMLElement>(".model-3d-visor")!;
  const visor = document.createElement("model-viewer") as ModelViewerElement;
  visor.className = "absolute inset-0 h-full w-full";
  const modeloUrl = new URL(bloque.dataset.src!, location.href);
  // model-viewer memoriza también los modelos fallidos: otro intento necesita una URL nueva.
  if (intentoModelo) modeloUrl.searchParams.set("reintento", String(intentoModelo));
  visor.setAttribute("src", origen ?? modeloUrl.href);
  visor.setAttribute("alt", bloque.dataset.alt!);
  visor.setAttribute("camera-orbit", bloque.dataset.orbita!);
  visor.setAttribute("shadow-intensity", "1");
  visor.setAttribute("camera-controls", "");
  if ("recorrible" in bloque.dataset) activarRecorrido(visor, sinMovimiento);
  else visor.setAttribute("disable-pan", "");
  visor.setAttribute("touch-action", "pan-y");
  visor.setAttribute("interaction-prompt", "none");
  visor.style.setProperty("--poster-color", "transparent");
  // El avance lo muestra la capa con el loader, no la barra propia de model-viewer.
  const sinBarra = document.createElement("div");
  sinBarra.slot = "progress-bar";
  visor.append(sinBarra);
  if (!sinMovimiento()) visor.setAttribute("auto-rotate", "");
  const cargaFallida = () => {
    terminar();
    visor.remove();
    ofrecerBoton(bloque, intentoModelo + 1);
  };
  visor.addEventListener("error", cargaFallida, { once: true });
  visor.addEventListener(
    "load",
    () => {
      visor.removeEventListener("error", cargaFallida);
      terminar();
      contenedor.querySelector(".model-3d-poster")?.remove();
      prepararPantallaCompleta(contenedor, visor);
      // Quien pulsó el botón sigue con el teclado en el visor. Lo enfocable es su lienzo, dentro del
      // shadow DOM, y al disparar `load` aún está oculto: el foco va en el fotograma siguiente.
      if ("pulsado" in bloque.dataset) {
        requestAnimationFrame(() => (visor.shadowRoot?.querySelector<HTMLElement>("[tabindex]") ?? visor).focus());
      }
    },
    { once: true },
  );
  contenedor.append(visor);
}

/** Pantalla completa nativa o, sin ella (Safari en iPhone), el visor fijo a toda la ventana. */
function prepararPantallaCompleta(contenedor: HTMLElement, visor: HTMLElement) {
  const boton = contenedor.querySelector<HTMLButtonElement>(".model-3d-completa")!;
  const nativa = typeof contenedor.requestFullscreen === "function";
  const reflejar = (activa: boolean) => {
    boton.setAttribute("aria-pressed", String(activa));
    boton.setAttribute("aria-label", activa ? "Salir de pantalla completa" : "Ver en pantalla completa");
    visor.setAttribute("touch-action", activa ? "none" : "pan-y");
  };
  const expandir = (activa: boolean) => {
    contenedor.classList.toggle("is-expandido", activa);
    html.classList.toggle("overflow-hidden", activa);
    reflejar(activa);
  };
  boton.hidden = false;
  boton.addEventListener("click", () => {
    if (contenedor.classList.contains("is-expandido")) expandir(false);
    else if (document.fullscreenElement === contenedor) document.exitFullscreen();
    else if (nativa) contenedor.requestFullscreen().catch(() => expandir(true));
    else expandir(true);
  });
  document.addEventListener("fullscreenchange", () =>
    reflejar(document.fullscreenElement === contenedor),
  );
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && contenedor.classList.contains("is-expandido")) {
      expandir(false);
      boton.focus();
    }
  });
}

alCambiarMovimiento(() => {
  for (const visor of document.querySelectorAll("model-viewer")) {
    visor.toggleAttribute("auto-rotate", !sinMovimiento());
  }
});

/** Muestra el botón para cargar el modelo (o reintentarlo) y lo carga al pulsarlo. */
function ofrecerBoton(bloque: HTMLElement, intentoModelo = 0) {
  const boton = bloque.querySelector<HTMLButtonElement>(".model-3d-cargar")!;
  boton.hidden = false;
  boton.addEventListener(
    "click",
    () => {
      boton.hidden = true;
      bloque.dataset.pulsado = "";
      if ("pesado" in bloque.dataset) descargar(bloque, intentoModelo);
      else montar(bloque, intentoModelo);
    },
    { once: true },
  );
}

// Los modelos pesados se guardan en Cache Storage: la caché HTTP de un celular puede
// descartar decenas de MB en cualquier momento.
const ALMACEN = "modelos-3d";
/** Caché del navegador para los modelos descargados, si existe. */
const almacen = () => ("caches" in window ? caches.open(ALMACEN) : Promise.resolve(undefined));

/** URL local del modelo si ya está en la caché del navegador. */
async function guardado(bloque: HTMLElement) {
  try {
    const respuesta = await (await almacen())?.match(new URL(bloque.dataset.src!, location.href).href);
    return respuesta ? URL.createObjectURL(await respuesta.blob()) : undefined;
  } catch {
    return undefined;
  }
}

/** Descarga un modelo pesado con su avance en MB, lo guarda en la caché y lo monta. */
async function descargar(bloque: HTMLElement, intentoModelo = 0) {
  const megas = Number(bloque.dataset.megas);
  const url = new URL(bloque.dataset.src!, location.href).href;
  avisar(bloque, `Descargando 0 de ${megas} MB`, "Descargando el modelo 3D", 0);
  cargarLibreria().catch(() => {});
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok || !respuesta.body) throw new Error(`modelo: ${respuesta.status}`);
    // Comprimido, Content-Length es el tamaño en red y el lector cuenta los bytes ya descomprimidos.
    const total = (!respuesta.headers.has("content-encoding") && Number(respuesta.headers.get("content-length"))) || Number(bloque.dataset.bytes);
    const lector = respuesta.body.getReader();
    const partes: BlobPart[] = [];
    let recibido = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      partes.push(value as Uint8Array<ArrayBuffer>);
      recibido += value.length;
      const porcentaje = Math.min(100, Math.round((recibido / total) * 100));
      avisar(bloque, `Descargando ${Math.round(recibido / 1_000_000)} de ${megas} MB`, "Descargando el modelo 3D", porcentaje);
    }
    const blob = new Blob(partes, { type: "model/gltf-binary" });
    try {
      const cache = await almacen();
      if (cache) {
        const ruta = new URL(url).pathname;
        for (const vieja of await cache.keys()) {
          if (new URL(vieja.url).pathname === ruta) await cache.delete(vieja);
        }
        await cache.put(url, new Response(blob, { headers: { "Content-Type": "model/gltf-binary" } }));
      }
    } catch (error) {
      // Sin espacio para guardarlo se muestra igual; la próxima visita lo volverá a pedir.
      console.warn("No se pudo guardar el modelo 3D:", error);
    }
    avisar(bloque, "Cargando el modelo 3D…", "Cargando el modelo 3D");
    montar(bloque, intentoModelo, URL.createObjectURL(blob));
  } catch (error) {
    console.error("No se pudo descargar el modelo 3D:", error);
    ocultarAviso(bloque);
    ofrecerBoton(bloque, intentoModelo + 1);
  }
}

const ahorroDatos = (navigator as any).connection?.saveData === true;
const livianos = bloques.filter((bloque) => !("pesado" in bloque.dataset));

for (const bloque of bloques) {
  if (!("pesado" in bloque.dataset)) continue;
  guardado(bloque).then((origen) => (origen ? montar(bloque, 0, origen) : ofrecerBoton(bloque)));
}

if (ahorroDatos) {
  livianos.forEach(bloque => ofrecerBoton(bloque));
} else {
  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        observador.unobserve(entrada.target);
        montar(entrada.target as HTMLElement);
      }
    },
    { rootMargin: "200px" },
  );
  for (const bloque of livianos) observador.observe(bloque);
}
