// Campana de avisos de la cabecera: solo la descarga quien puede editar el contenido (la importa layout.ts).
import { sinMovimiento } from "../../lib/comun/movimiento";
import { publicacionSeguida, publicarAvisos, type Aviso } from "../../lib/comun/avisos";
import { avisoVisto } from "../../lib/cuenta/auth/navigation";
import { esc } from "../../lib/comun/html";
import { iconSvg } from "../../lib/comun/iconos";
import { notificar } from "../../lib/comun/notificacion";
import { adminApi } from "../../lib/data/http/admin-api";

const MINUTO = 60_000;
const campana = document.querySelector<HTMLButtonElement>("#avisos-campana")!;
const numero = campana.querySelector<HTMLElement>("[data-avisos-numero]")!;
const cabecera = document.querySelector<HTMLElement>(".site-header")!;
const lista = document.createElement("div");
lista.id = "avisos-lista";
lista.setAttribute("role", "region");
lista.setAttribute("aria-label", "Avisos");
lista.className = "absolute z-[70] w-[380px] rounded-[4px] border border-t-[3px] border-base-300 border-t-secondary bg-base-100 px-2 pt-3 pb-2 text-primary [box-shadow:0_12px_30px_#0631762e] max-tablet:w-auto";
lista.hidden = true;
let avisos: Aviso[] = [];

/** Fila de la lista: todo el aviso es el enlace, con las clases de los enlaces de DropdownLink.astro. */
const fila = (a: Aviso) => `
  <a href="${esc(a.ruta)}" class="flex items-center gap-3 rounded-[3px] px-3 py-3.5 text-[0.82rem] hover:bg-base-200">
    <span class="grid size-[34px] shrink-0 place-items-center rounded-full ${a.tipo === "error" ? "bg-error-soft text-error" : "bg-primary-soft text-primary"}">${iconSvg(a.icono, 18)}</span>
    <span class="min-w-0 flex-1 leading-[1.4]"><span class="block">${esc(a.texto)}</span><strong class="mt-0.5 block text-[0.78rem]">${esc(a.accion)}</strong></span>
    ${iconSvg("chevronRight", 18)}
  </a>`;

/** Ancla la lista bajo la campana, con el pico apuntándola; en celular ocupa el ancho de la pantalla. */
function colocar() {
  const c = campana.getBoundingClientRect(), p = (lista.offsetParent ?? cabecera).getBoundingClientRect();
  const celular = innerWidth <= 760;
  // Borde derecho de la lista en la pantalla; el estilo se da respecto al contenedor que la posiciona.
  const borde = celular ? innerWidth - 12 : Math.min(c.right + 12, innerWidth - 12);
  Object.assign(lista.style, { top: `${c.bottom - p.top + 12}px`, right: `${p.right - borde}px`, left: celular ? `${12 - p.left}px` : "" });
  const pico = lista.querySelector<HTMLElement>("[data-pico]");
  if (pico) pico.style.right = `${borde - (c.left + c.width / 2) - 9}px`;
  // Solo se desplazan las filas, y nunca pasan del borde de la pantalla.
  const filas = lista.querySelector<HTMLElement>("[data-filas]");
  if (filas) filas.style.maxHeight = `min(340px, calc(100dvh - ${Math.round(c.bottom) + 80}px))`;
}

/** Pinta el número de la campana y, si está abierta, la lista. */
function pintar() {
  const total = avisos.reduce((suma, a) => suma + a.cantidad, 0);
  numero.hidden = !total;
  numero.textContent = total > 99 ? "99+" : String(total);
  campana.setAttribute("aria-label", total ? `Avisos: ${total}` : "Avisos: ninguno");
  lista.innerHTML = `<span data-pico aria-hidden="true" class="absolute -top-3 size-0 border-x-[9px] border-b-[9px] border-x-transparent border-b-secondary"></span>
    <strong class="block px-3 pb-2 text-[0.82rem]">Avisos</strong>
    ${avisos.length
      ? `<div data-filas class="overflow-y-auto overscroll-contain border-y border-base-300">${avisos.map((a) => `<div class="border-t border-base-300 pt-1 first:border-t-0">${fila(a)}</div>`).join("")}</div>`
      : `<p class="m-0 px-3 pt-2 pb-3 text-[0.84rem] leading-[1.45]">No tienes avisos.</p>`}`;
  if (!lista.hidden) colocar();
}

/** Vuelve a pedir los avisos; si la red falla, se queda con los que tenía. */
async function leerAvisos() {
  try {
    avisos = (await adminApi.avisos()).avisos;
  } catch {
    return false;
  }
  pintar();
  publicarAvisos(avisos);
  return true;
}

/** Abre o cierra la lista; al abrirla la pone al día. */
function abrir(abierta: boolean) {
  lista.hidden = !abierta;
  campana.setAttribute("aria-expanded", String(abierta));
  if (!abierta) return;
  colocar();
  void leerAvisos();
  if (!sinMovimiento()) lista.animate([{ opacity: 0, transform: "scale(0.92)" }, { opacity: 1, transform: "scale(1)" }], { duration: 160, easing: "ease-out" });
}

/** Consulta la publicación seguida hasta que termina y avisa de cómo acabó. */
async function vigilarPublicacion() {
  const id = publicacionSeguida();
  if (!id) return;
  const publicacion = await adminApi.publications(1).then((p) => p.publicaciones.find((x) => x.id === id)).catch(() => undefined);
  if (publicacion?.estado === "publicada" || publicacion?.estado === "fallida") {
    publicacionSeguida(true);
    notificar(publicacion.estado === "publicada"
      ? { tipo: "exito", titulo: "Sitio publicado", texto: "Los cambios ya se ven en el sitio." }
      : { tipo: "error", titulo: "No se pudo publicar", texto: "El sitio sigue mostrando la versión anterior. Inténtalo de nuevo.", enlace: { texto: "Ver publicaciones", ruta: "/cuenta/panel/#publicaciones" } });
    void leerAvisos();
  } else setTimeout(() => void vigilarPublicacion(), 4000);
}

/** Muestra la campana y la mantiene al día; la notificación de errores sale solo al entrar (no en el panel, que los marca). */
export async function iniciarAvisos(enPanel: boolean) {
  campana.after(lista);
  campana.hidden = false;
  campana.addEventListener("click", (e) => { e.stopPropagation(); abrir(lista.hidden); });
  lista.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => { if (!lista.hidden) abrir(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lista.hidden) { abrir(false); campana.focus(); }
  });
  campana.parentElement!.addEventListener("focusout", (e) => {
    if (!lista.hidden && !campana.parentElement!.contains(e.relatedTarget as Node)) abrir(false);
  });
  addEventListener("resize", () => { if (!lista.hidden) colocar(); });
  document.addEventListener("avisos:pedir", () => void leerAvisos());
  document.addEventListener("avisos:publicando", () => void vigilarPublicacion());
  // Lo que cambian otras personas llega al volver a la pestaña y cada minuto mientras está a la vista.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void leerAvisos(); });
  setInterval(() => { if (!document.hidden) void leerAvisos(); }, MINUTO);
  void vigilarPublicacion();
  if (!(await leerAvisos()) || avisoVisto()) return;
  avisoVisto(true);
  const errores = avisos.filter((a) => a.tipo === "error");
  if (enPanel || !errores.length) return;
  notificar(errores.length === 1
    ? { tipo: "aviso", titulo: "Tienes 1 aviso", texto: errores[0].texto, enlace: { texto: errores[0].accion, ruta: errores[0].ruta } }
    : { tipo: "aviso", titulo: `Tienes ${errores.length} avisos`, texto: "Hay contenido publicado que necesita cambios.", enlace: { texto: "Ir al panel", ruta: errores[0].ruta } });
}
