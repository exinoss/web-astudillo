import { PASOS, gestoDe, ladoPara, momentos, type Paso, type Posicion, type Visita } from "../../../lib/comun/guia/pasos";
import { altoCabecera, espera, esperarA, rectDe, rectEl, visibles, type Rect } from "../../../lib/comun/guia/elementos";
import { guardarClave, leerClave } from "../../../lib/comun/almacen";
import { bloquearMientras } from "../../../lib/comun/cambios";
import { sinMovimiento } from "../../../lib/comun/movimiento";
import { crearAvatar, type Avatar } from "./avatar";
import { crearFoco, focoA, quitarFoco } from "./foco";
import { activarCursor, desactivarCursor, hayCursor, moverCursorA, pulsarCursor } from "./cursor";
import { ajustarCorreo, mostrarCorreo, quitarCorreo } from "./correo";
import { urlAudio } from "./audios";

const raiz = document.querySelector<HTMLElement>("[data-guia]")!;
const escenario = raiz.querySelector<HTMLElement>("[data-guia-escenario]")!;
const caja = raiz.querySelector<HTMLElement>("[data-guia-caja]")!;
const texto = caja.querySelector<HTMLElement>("[data-guia-texto]")!;
/** Botón de los controles de la guía por su nombre (`data-guia-<nombre>`). */
const boton = (nombre: string) => caja.querySelector<HTMLButtonElement>(`[data-guia-${nombre}]`)!;
const RUTA = location.pathname;
/** Indica si hay una sesión iniciada (lo marca el layout en <html>). */
const conSesion = () => document.documentElement.hasAttribute("data-sesion");

let avatar: Avatar | null = null;
let ctx: AudioContext | null = null;
// Un elemento solo puede conectarse a un AudioContext: cada guía usa uno nuevo.
let audio = new Audio();
let conectado = false;
let conAudio = true;
let reloj = { inicio: 0, acumulado: 0, total: 1 };
let indice = -1;
let posicion: Posicion = "centro";
let pausado = false;
let silenciado = false;
let abiertos: HTMLElement[] = [];
let rafId = 0;
let origen: HTMLElement | null = null;

/** Crea o reanuda el AudioContext; debe llamarse dentro de un clic para que el navegador lo permita. */
export function crearContexto() {
  const Contexto = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!ctx && Contexto) ctx = new Contexto();
  if (ctx?.state === "suspended") ctx.resume().catch(() => {});
}

/** Muestra «Reintentar» en lugar de los controles de reproducción, o al revés. */
function mostrarError(si: boolean) {
  boton("reintentar").hidden = !si;
  boton("pausa").hidden = si;
  boton("voz").hidden = si;
}

/** Muestra el escenario y los subtítulos y carga al personaje; si falla, ofrece reintentar. */
async function montar() {
  raiz.hidden = false;
  crearFoco();
  activarCursor();
  colocar();
  addEventListener("keydown", alTeclear);
  addEventListener("resize", colocar);
  if (avatar) return true;
  mostrarError(false);
  texto.textContent = "Cargando la guía…";
  try {
    avatar = await crearAvatar(escenario);
    if (ctx) avatar.audioCtx = ctx;
    return true;
  } catch {
    texto.textContent = "No se pudo cargar la guía.";
    mostrarError(true);
    return false;
  }
}

/** Abre la guía en el paso `i`; al cerrarla, el foco vuelve a `desde`. */
export async function empezar(i: number, desde?: HTMLElement | null) {
  origen = desde ?? origen;
  guardarClave("local", "guia-vista", "1");
  crearContexto();
  if (await montar()) ejecutar(i);
}

/** Sigue la guía si la página anterior la dejó en un paso de esta; devuelve si lo hizo. */
export function retomar() {
  const pendiente = Number(leerClave("sesion", "guia-paso") ?? Number.NaN);
  const paso = PASOS[pendiente];
  if (!paso || (paso.pagina !== "*" && paso.pagina !== RUTA)) return false;
  guardarClave("sesion", "guia-paso", null);
  montar().then((ok) => {
    if (ok) ejecutar(pendiente);
  });
  return true;
}

/** Detiene lo que hace el paso actual y cierra lo que abrió. */
function limpiarPaso() {
  cancelAnimationFrame(rafId);
  audio.onended = null;
  audio.pause();
  avatar?.detenerHabla();
  cerrarAbiertos();
  quitarCorreo();
}

/** Cierra en orden inverso lo que abrió el cursor (submenú antes que el menú). */
function cerrarAbiertos() {
  abiertos.reverse().forEach((el) => {
    const abierto = el.getAttribute("aria-expanded") === "true" || (el.tagName === "SUMMARY" && (el.parentElement as HTMLDetailsElement).open);
    if (abierto) el.click();
  });
  abiertos = [];
}

/** Primer paso desde `i` que aplica (con sesión se saltan los de crear la cuenta). */
function siguienteValido(i: number) {
  let j = i;
  while (PASOS[j]?.soloSinSesion && conSesion()) j++;
  return j;
}

/** Prepara el paso `i` (página, foco, Carlos y subtítulo) y lo reproduce; si su elemento no está, lo salta. */
async function ejecutar(desde: number) {
  limpiarPaso();
  const i = siguienteValido(desde);
  const paso = PASOS[i];
  if (!paso || (paso.pagina !== "*" && paso.pagina !== RUTA)) return terminar();
  indice = i;
  pausado = false;
  actualizarPausa();
  if (paso.esperar) await esperarA(paso.esperar, 4000);
  if (paso.correo) await mostrarCorreo(caja, escenario);
  if (indice !== i) return;
  if (paso.foco && !rectDe(paso.foco)) return ejecutar(i + 1);
  await desplazar(paso);
  if (indice !== i) return;
  moverAvatar(paso, paso.foco ? rectDe(paso.foco) : null);
  texto.textContent = paso.texto;
  mostrarError(false);
  ajustarCorreo(caja, escenario);
  focoA(paso.foco ? rectDe(paso.foco) : null);
  reproducirPaso(paso, i);
}

/** Desplaza suavemente la página hasta `top`. */
const ir = (top: number) => scrollTo({ top, behavior: sinMovimiento() ? "auto" : "smooth" });

/** Lleva la página al principio o al elemento del paso, bajo la cabecera. */
async function desplazar(paso: Paso) {
  if (paso.arriba) ir(0);
  else if (paso.foco && !paso.fijo) ir(scrollY + (rectDe(paso.foco)?.y ?? 0) - altoCabecera() - 20);
  else return;
  await espera(sinMovimiento() ? 60 : 650);
}

/** Deja el elemento entre la cabecera y Carlos. */
async function asegurarVisible(el: Element) {
  const r = el.getBoundingClientRect();
  const arriba = altoCabecera() + 12;
  const abajo = innerHeight - escenario.getBoundingClientRect().height - 16;
  if (getComputedStyle(el).position === "fixed" || el.closest(".site-header") || (r.top >= arriba && r.bottom <= abajo)) return;
  ir(scrollY + r.top - arriba - Math.max(0, (abajo - arriba - r.height) / 3));
  await espera(sinMovimiento() ? 60 : 500);
}

/** Pone a Carlos al lado contrario del elemento y le da el gesto que lo señala. */
function moverAvatar(paso: Paso, r: Rect | null, actual: Posicion = paso.posicion ?? "izquierda") {
  posicion = paso.gesto ? (paso.posicion ?? "centro") : ladoPara(r, innerWidth, actual);
  colocar();
  avatar?.setEstado(paso.gesto ?? gestoDe(posicion));
}

/** Coloca a Carlos en su lado, los subtítulos sobre él y, si está abierto, el correo. */
function colocar() {
  const { width: w, height: h } = escenario.getBoundingClientRect();
  const m = 12;
  const x = { izquierda: m, derecha: innerWidth - w - m, centro: (innerWidth - w) / 2 }[posicion];
  escenario.style.transform = `translateX(${x}px)`;
  const cw = caja.getBoundingClientRect().width;
  caja.style.left = `${Math.min(Math.max(m, x + w / 2 - cw / 2), innerWidth - cw - m)}px`;
  caja.style.bottom = `${h - 6}px`;
  ajustarCorreo(caja, escenario);
}

/** Avance del paso (0-1): el del audio o, sin audio, el del tiempo estimado. */
function progreso() {
  if (conAudio) return audio.duration ? audio.currentTime / audio.duration : 0;
  return (reloj.acumulado + (pausado ? 0 : performance.now() - reloj.inicio)) / reloj.total;
}

/** Reproduce el audio del paso; si el navegador lo bloquea, pide «Continuar»; si no se descarga, sigue sin sonido. */
async function reproducirPaso(paso: Paso, i: number) {
  audio.src = urlAudio(paso.id);
  audio.muted = silenciado;
  conAudio = true;
  try {
    await audio.play();
  } catch (error) {
    if (indice !== i) return;
    if ((error as DOMException).name === "NotAllowedError") return mostrarContinuar(true);
    conAudio = false;
  }
  if (indice !== i || !avatar) return;
  if (conAudio) {
    if (!conectado && ctx?.state === "running") {
      avatar.audioCtx = ctx;
      avatar.conectarAudio(audio);
      conectado = true;
    }
    if (!conectado || silenciado) bocaPorGuion(paso);
    audio.onended = () => finPaso(paso, i);
  } else {
    reloj = { inicio: performance.now(), acumulado: 0, total: Math.max(1500, (paso.texto.split(/\s+/).length / 2.5) * 1000) };
    avatar.animarGuion(paso.texto, reloj.total);
  }
  seguir(paso, i);
}

/** Mueve la boca según el texto durante lo que queda del paso (sin sonido o sin AudioContext). */
function bocaPorGuion(paso: Paso) {
  if (!avatar) return;
  const resta = conAudio ? (audio.duration - audio.currentTime) * 1000 : reloj.total * (1 - progreso());
  if (conAudio && conectado) avatar.activeAudioEl = null;
  avatar.animarGuion(paso.texto, Math.max(400, resta || 3000));
}

/** Bucle del paso: lleva el foco y el cursor a cada elemento cuando la voz lo nombra; sin audio, cierra el paso a su tiempo. */
function seguir(paso: Paso, i: number) {
  const visitas = paso.recorrido ?? [];
  const cuando = momentos(paso, conAudio ? audio.duration : reloj.total / 1000);
  let hecho = -1;
  let enCurso = false;
  let focoActual: (() => Rect | null) | null = null;
  const tick = () => {
    if (indice !== i) return;
    const p = progreso();
    if (!enCurso && !pausado && hecho + 1 < visitas.length && p >= cuando[hecho + 1]!) {
      hecho++;
      enCurso = true;
      visitar(visitas[hecho]!, paso, i, (f) => (focoActual = f)).finally(() => (enCurso = false));
    }
    if (paso.foco) focoA((paso.focoSigue && focoActual?.()) || rectDe(paso.foco));
    if (!conAudio && !pausado && p >= 1) return finPaso(paso, i);
    rafId = requestAnimationFrame(tick);
  };
  tick();
}

/** Lleva el cursor a los elementos de la visita, mueve el foco con él y, si toca, los pulsa. */
async function visitar(visita: Visita, paso: Paso, i: number, alFoco: (f: () => Rect | null) => void) {
  for (const el of visibles(visita.sel).slice(0, visita.max ?? 6)) {
    if (indice !== i) return;
    alFoco(() => (visita.foco ? rectDe(visita.foco) : null) ?? rectEl(el.closest("details") ?? el));
    await asegurarVisible(el);
    const r = rectEl(el);
    if (!paso.gesto && posicion !== ladoPara(r, innerWidth, posicion)) moverAvatar(paso, r, posicion);
    moverCursorA(r.x + Math.min(r.w / 2, 60), r.y + Math.min(r.h / 2, 40));
    await espera(sinMovimiento() || !hayCursor() ? 250 : 650);
    if (visita.clic && indice === i) {
      pulsarCursor();
      el.click();
      abiertos.push(el);
    }
    if ((visita.max ?? 1) > 1) await espera(350);
  }
}

/** Al terminar la voz: pulsa el botón real que lleva a la página siguiente, navega o pasa al paso siguiente. */
async function finPaso(paso: Paso, i: number) {
  if (indice !== i) return;
  cancelAnimationFrame(rafId);
  const el = paso.pulsar ? visibles(paso.pulsar)[0] : undefined;
  if (el) {
    await asegurarVisible(el);
    const r = rectEl(el);
    moverCursorA(r.x + r.w / 2, r.y + r.h / 2);
    focoA(r);
    await espera(sinMovimiento() || !hayCursor() ? 300 : 700);
    if (indice !== i) return;
    pulsarCursor();
    cerrarAbiertos();
    guardarClave("sesion", "guia-paso", String(i + 1));
    await espera(250);
    el.click();
    return;
  }
  if (paso.ir) {
    cerrarAbiertos();
    guardarClave("sesion", "guia-paso", String(i + 1));
    location.href = paso.ir;
    return;
  }
  await espera(250);
  if (indice === i) ejecutar(i + 1);
}

/** Cambia los controles por «Continuar» cuando el navegador no deja sonar el audio sin un clic. */
function mostrarContinuar(si: boolean) {
  boton("continuar").hidden = !si;
  boton("pausa").hidden = si;
  boton("voz").hidden = si;
  if (si) boton("continuar").focus();
}

/** Pausa o reanuda la voz y el recorrido. */
function alternarPausa() {
  const paso = PASOS[indice];
  if (!paso || !avatar) return;
  pausado = !pausado;
  if (pausado) {
    audio.pause();
    avatar.detenerHabla();
    if (conectado) avatar.activeAudioEl = audio;
    avatar.setEstado("idle");
    if (!conAudio) reloj.acumulado += performance.now() - reloj.inicio;
  } else {
    avatar.setEstado(paso.gesto ?? gestoDe(posicion));
    if (conAudio) audio.play().then(() => (!conectado || silenciado) && bocaPorGuion(paso)).catch(() => {});
    else {
      reloj.inicio = performance.now();
      bocaPorGuion(paso);
    }
  }
  actualizarPausa();
}

/** Muestra el icono y el nombre del botón según si la guía está en pausa. */
function actualizarPausa() {
  const b = boton("pausa");
  b.querySelector<HTMLElement>("[data-pausar]")!.hidden = pausado;
  b.querySelector<HTMLElement>("[data-reanudar]")!.hidden = !pausado;
  b.setAttribute("aria-label", pausado ? "Reanudar la guía" : "Pausar la guía");
}

/** Silencia o devuelve la voz; sin sonido, la boca sigue el texto. */
function alternarVoz() {
  silenciado = !silenciado;
  audio.muted = silenciado;
  const b = boton("voz");
  b.querySelector<HTMLElement>("[data-con-voz]")!.hidden = silenciado;
  b.querySelector<HTMLElement>("[data-sin-voz]")!.hidden = !silenciado;
  b.setAttribute("aria-pressed", String(silenciado));
  b.setAttribute("aria-label", silenciado ? "Activar la voz de Carlos" : "Silenciar a Carlos");
  const paso = PASOS[indice];
  if (!paso || !avatar || pausado || !conAudio) return;
  if (silenciado) bocaPorGuion(paso);
  else if (conectado) {
    avatar.detenerHabla();
    avatar.activeAudioEl = audio;
  }
}

/** Escape cierra la guía, como «Saltar guía». */
const alTeclear = (evento: KeyboardEvent) => {
  if (evento.key === "Escape" && indice >= 0) terminar();
};

/** Cierra la guía, libera el audio y al personaje, y devuelve el foco a donde estaba. */
function terminar() {
  limpiarPaso();
  indice = -1;
  guardarClave("sesion", "guia-paso", null);
  guardarClave("local", "guia-vista", "1");
  avatar?.destruir();
  avatar = null;
  audio = new Audio();
  conectado = false;
  ctx?.close().catch(() => {});
  ctx = null;
  quitarFoco();
  desactivarCursor();
  raiz.hidden = true;
  removeEventListener("keydown", alTeclear);
  removeEventListener("resize", colocar);
  const volver = origen?.isConnected ? origen : document.querySelector<HTMLElement>("[data-guia-abrir]") ?? document.querySelector<HTMLElement>("#contenido");
  volver?.focus();
}

boton("pausa").addEventListener("click", alternarPausa);
boton("voz").addEventListener("click", alternarVoz);
boton("saltar").addEventListener("click", terminar);
boton("continuar").addEventListener("click", () => {
  crearContexto();
  mostrarContinuar(false);
  ejecutar(indice);
});
boton("reintentar").addEventListener("click", (evento) => {
  const b = evento.currentTarget as HTMLButtonElement;
  bloquearMientras(b, () => empezar(Math.max(indice, 0), origen));
});
