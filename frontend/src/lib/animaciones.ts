import type { AnimationItem, LottiePlayer } from "lottie-web";
// Como URLs y no con `import()`: un `import()` fallido queda memorizado y no se puede reintentar.
import reproductorUrl from "lottie-web/build/player/lottie_light.min.js?url";
import loaderUrl from "../assets/animated/loader-vota6.min.json?url";
import marcaUrl from "../assets/animated/marca-vota6.min.json?url";

const ANIMACIONES = {
  loader: { url: loaderUrl, fotogramaQuieto: 70 },
  marca: { url: marcaUrl, fotogramaQuieto: 40 },
};
type Animacion = keyof typeof ANIMACIONES;

const html = document.documentElement;
export const sinMovimiento = () => html.classList.contains("reduce-motion");
export const ahorroDatos = (navigator as any).connection?.saveData === true;

let reproductor: Promise<LottiePlayer> | undefined;
let intentos = 0;
const datos = new Map<Animacion, Promise<unknown>>();
const activas = new Set<{ item: AnimationItem; quieto: number }>();

/** Carga lottie_light como script clásico; si falla, la próxima llamada lo reintenta. */
function cargarReproductor() {
  return (reproductor ??= new Promise<LottiePlayer>((resolver, rechazar) => {
    const script = document.createElement("script");
    script.src = intentos ? `${reproductorUrl}?reintento=${intentos}` : reproductorUrl;
    script.onload = () => resolver((window as any).lottie);
    script.onerror = rechazar;
    document.head.append(script);
  }).catch((error) => {
    reproductor = undefined;
    intentos++;
    throw error;
  }));
}

function cargarDatos(animacion: Animacion) {
  let promesa = datos.get(animacion);
  if (!promesa) {
    promesa = fetch(ANIMACIONES[animacion].url)
      .then((r) => {
        if (!r.ok) throw new Error(`${animacion}: ${r.status}`);
        return r.json();
      })
      .catch((error) => {
        datos.delete(animacion);
        throw error;
      });
    datos.set(animacion, promesa);
  }
  return promesa;
}

/** Descarga reproductor y animación sin mostrar nada, para que luego aparezcan al instante. */
export function precargar(animacion: Animacion) {
  if (ahorroDatos) return;
  Promise.all([cargarReproductor(), cargarDatos(animacion)]).catch(() => {});
}

/**
 * Reproduce en bucle dentro de `contenedor`; con `reduce-motion` queda en un fotograma fijo.
 * `alCompletarVuelta` se llama al terminar cada vuelta completa.
 * Devuelve la función que la destruye, o nada si no se pudo pintar (error o ahorro de datos).
 */
export async function reproducir(
  contenedor: HTMLElement,
  animacion: Animacion,
  alCompletarVuelta?: () => void,
) {
  if (ahorroDatos) return;
  try {
    const [lottie, animationData] = await Promise.all([
      cargarReproductor(),
      cargarDatos(animacion),
    ]);
    const item = lottie.loadAnimation({
      container: contenedor,
      renderer: "svg",
      loop: true,
      autoplay: false,
      // lottie modifica los datos al cargarlos: cada instancia necesita su copia.
      animationData: structuredClone(animationData),
    });
    if (alCompletarVuelta) item.addEventListener("loopComplete", alCompletarVuelta);
    const activa = { item, quieto: ANIMACIONES[animacion].fotogramaQuieto };
    activas.add(activa);
    aplicarMovimiento(activa);
    return () => {
      activas.delete(activa);
      item.destroy();
    };
  } catch (error) {
    console.error("No se pudo cargar la animación:", error);
  }
}

function aplicarMovimiento({ item, quieto }: { item: AnimationItem; quieto: number }) {
  if (sinMovimiento()) item.goToAndStop(quieto, true);
  else item.play();
}

new MutationObserver(() => activas.forEach(aplicarMovimiento)).observe(html, {
  attributes: true,
  attributeFilter: ["class"],
});

// Quien empieza a rellenar un formulario probablemente lo enviará: el loader queda listo antes.
document.addEventListener("focusin", function alEnfocar(evento) {
  if (!(evento.target as Element).closest?.("form")) return;
  document.removeEventListener("focusin", alEnfocar);
  precargar("loader");
});

/**
 * Cubre `zona` con el loader mientras dura un envío o una carga de datos.
 * Solo aparece si tarda más de 200 ms, para no parpadear en respuestas rápidas.
 */
export function mostrarCarga(zona: HTMLElement, texto = "Enviando…") {
  zona.setAttribute("aria-busy", "true");
  let destruir: (() => void) | undefined;
  let terminada = false;
  const capa = document.createElement("div");
  capa.className =
    "absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-base-100/90 text-sm font-bold text-primary";
  capa.setAttribute("role", "status");
  const lienzo = document.createElement("div");
  lienzo.className = "size-32";
  lienzo.setAttribute("aria-hidden", "true");
  const leyenda = document.createElement("span");
  leyenda.textContent = texto;
  capa.append(lienzo, leyenda);
  const temporizador = setTimeout(async () => {
    zona.classList.add("relative");
    zona.append(capa);
    const fin = await reproducir(lienzo, "loader");
    if (terminada) fin?.();
    else destruir = fin;
  }, 200);
  return () => {
    terminada = true;
    clearTimeout(temporizador);
    destruir?.();
    capa.remove();
    zona.removeAttribute("aria-busy");
  };
}
