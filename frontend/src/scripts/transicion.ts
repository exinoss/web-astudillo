import { ahorroDatos, precargar, reproducir, sinMovimiento } from "../lib/animaciones";

const capa = document.querySelector<HTMLElement>(".transicion")!;
const lienzo = capa.querySelector<HTMLElement>(".transicion-lienzo")!;
// Si el reproductor aún no ha descargado, la navegación no se retrasa más que esto.
const ESPERA_MAXIMA = 1500;
// Si la navegación no ocurre (descarga, enlace cancelado), la capa no se queda pegada.
const LIMITE = 10000;

let navegando = false;
let temporizadores: number[] = [];
let destruir: (() => void) | undefined;

function ocultar() {
  temporizadores.forEach(clearTimeout);
  temporizadores = [];
  destruir?.();
  destruir = undefined;
  capa.hidden = true;
  navegando = false;
}

/** Enlace que abre otra página del sitio en esta misma pestaña. */
function enlaceInterno(evento: MouseEvent) {
  if (evento.defaultPrevented || evento.button !== 0) return;
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  const enlace = (evento.target as Element).closest?.<HTMLAnchorElement>("a[href]");
  if (!enlace || enlace.hasAttribute("download")) return;
  if (enlace.target && enlace.target !== "_self") return;
  const destino = new URL(enlace.href, location.href);
  if (destino.origin !== location.origin) return;
  const mismaPagina =
    destino.pathname === location.pathname && destino.search === location.search;
  if (mismaPagina && (destino.hash || enlace.getAttribute("href") === "#")) return;
  return enlace;
}

/** Pide la página destino mientras corre la animación, para que al navegar ya esté en caché. */
function prefetch(url: string) {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  document.head.append(link);
}

// Con ahorro de datos o «Reducir movimiento» se navega sin retrasar la página.
if (!ahorroDatos) {
  // La intención de navegar (pasar el cursor, tocar o enfocar un enlace) adelanta la descarga.
  for (const tipo of ["pointerover", "touchstart", "focusin"]) {
    document.addEventListener(
      tipo,
      function alIntentar(evento) {
        if (!(evento.target as Element).closest?.("a[href]")) return;
        document.removeEventListener(tipo, alIntentar);
        precargar("marca");
      },
      { passive: true },
    );
  }

  // Se navega al completar una vuelta de la papeleta: así se ve aunque la página llegue rápido.
  document.addEventListener("click", async (evento) => {
    const enlace = enlaceInterno(evento);
    if (!enlace || sinMovimiento()) return;
    evento.preventDefault();
    if (navegando) return;
    navegando = true;
    const destino = enlace.href;
    prefetch(destino);
    let fue = false;
    const ir = () => {
      if (fue) return;
      fue = true;
      location.assign(destino);
    };
    const espera = window.setTimeout(ir, ESPERA_MAXIMA);
    temporizadores.push(espera, window.setTimeout(ocultar, LIMITE));
    const fin = await reproducir(lienzo, "marca", ir);
    if (!fin) return ir();
    // Ya hay animación: la vuelta completa manda, no el tope de descarga.
    clearTimeout(espera);
    // Si la capa se ocultó mientras cargaba (p. ej. al volver atrás), no se muestra.
    if (!navegando) return fin();
    destruir = fin;
    capa.hidden = false;
  });

  // Al volver con «Atrás», la página sale de la caché con la capa aún visible.
  addEventListener("pageshow", (evento) => evento.persisted && ocultar());
}
