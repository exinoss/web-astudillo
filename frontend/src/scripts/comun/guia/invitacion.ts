import { SALUDO } from "../../../lib/comun/guia/pasos";
import { espera } from "../../../lib/comun/guia/elementos";
import { leerClave } from "../../../lib/comun/almacen";
import { ahorroDatos } from "../../../lib/comun/animaciones";
import { sinMovimiento } from "../../../lib/comun/movimiento";
import { crearAvatar, type Avatar } from "./avatar";
import { urlAudio } from "./audios";

const invitacion = document.querySelector<HTMLElement>("[data-guia-invitacion]");
let avatar: Avatar | null = null;
let saludo: HTMLAudioElement | null = null;
let cerrada = false;
/** Deja de esperar el primer toque para el saludo (se reemplaza al empezar a esperarlo). */
let dejarDeEsperar = () => {};

/** Carga a Carlos en la invitación (como mucho 4 s); con ahorro de datos no lo descarga hasta que se pida la guía. */
async function prepararAvatar(escena: HTMLElement) {
  if (ahorroDatos) return;
  const carga = crearAvatar(escena).then((nuevo) => {
    if (cerrada) return nuevo.destruir();
    avatar = nuevo;
    nuevo.setEstado("explicar");
  });
  await Promise.race([carga.catch(() => {}), espera(4000)]);
}

/** Mueve la boca con el saludo mientras suena `voz` y, al terminar, apunta a quien mira. */
async function hablar(personaje: Avatar, voz: HTMLAudioElement) {
  saludo = voz;
  personaje.setEstado("explicar");
  personaje.animarGuion(SALUDO.texto, voz.duration * 1000);
  await new Promise((resolver) => (voz.onended = resolver));
  if (avatar === personaje) personaje.setEstado("apuntar_usuario");
}

/** Dice el saludo con voz en el primer toque, clic o tecla mientras la invitación sigue abierta (antes, el navegador no deja sonar). */
function saludarAlTocar(personaje: Avatar) {
  const eventos = ["pointerup", "touchend", "keydown"];
  let intentando = false;
  /** Intenta el saludo con este toque; los botones de la invitación la cierran, así que no cuentan. */
  const alTocar = (evento: Event) => {
    if (avatar !== personaje || (evento.target as Element).closest?.("[data-guia-ver], [data-guia-no], [data-guia-abrir]")) return dejarDeEsperar();
    if (intentando) return;
    intentando = true;
    // play() tiene que llamarse dentro del propio evento para que el navegador lo permita.
    const voz = new Audio(urlAudio(SALUDO.id));
    voz.play().then(() => {
      dejarDeEsperar();
      if (avatar === personaje) hablar(personaje, voz);
      else voz.pause();
    }, () => (intentando = false));
  };
  eventos.forEach((nombre) => addEventListener(nombre, alTocar, true));
  dejarDeEsperar = () => eventos.forEach((nombre) => removeEventListener(nombre, alTocar, true));
}

/** Hace que Carlos diga el saludo; si el navegador no deja sonar, mueve la boca sin sonido y lo dice con voz en el primer toque. */
async function saludar(personaje: Avatar) {
  await espera(sinMovimiento() ? 0 : 700);
  if (avatar !== personaje) return;
  const voz = new Audio(urlAudio(SALUDO.id));
  const suena = await voz.play().then(() => true, () => false);
  if (avatar !== personaje) return voz.pause();
  if (suena) return hablar(personaje, voz);
  saludarAlTocar(personaje);
  if (!sinMovimiento()) personaje.animarGuion(SALUDO.texto, 1900);
  await espera(2000);
  if (avatar === personaje && !saludo) personaje.setEstado("apuntar_usuario");
}

/** Muestra la invitación en la primera visita a la portada, con Carlos ya listo para saludar. */
export function mostrarInvitacion() {
  if (!invitacion || leerClave("local", "guia-vista")) return;
  setTimeout(async () => {
    await prepararAvatar(invitacion.querySelector<HTMLElement>("[data-guia-escena]")!);
    if (cerrada) return;
    invitacion.hidden = false;
    if (avatar) saludar(avatar);
  }, 1200);
}

/** Cierra la invitación y libera el saludo y al personaje. */
export function quitarInvitacion() {
  cerrada = true;
  dejarDeEsperar();
  saludo?.pause();
  saludo = null;
  avatar?.destruir();
  avatar = null;
  if (invitacion) invitacion.hidden = true;
}
