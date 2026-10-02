import { errorText } from "../../lib/auth/page";
import { chatRepository } from "../../lib/data";
import { borrar, leer } from "../../lib/participacion/borrador";
import { enviarConSesion } from "../../lib/participacion/envio";

const form = document.querySelector<HTMLFormElement>("#chat-form")!;
const input = form.querySelector<HTMLInputElement>("#chat-input")!;
const log = document.querySelector<HTMLElement>(".chat-messages")!;
const mic = form.querySelector<HTMLButtonElement>("#chat-mic")!;
const escuchando = document.querySelector<HTMLElement>("#chat-escuchando")!;
const voz = document.querySelector<HTMLButtonElement>("#chat-voz")!;
const PREFERENCIA = "astudillo:chat-voz";
let ocupado = false;

/** Burbuja del chat; el texto siempre se pinta como texto, nunca como HTML. */
function burbuja(texto: string, deVotante = false, enlace?: { href: string; texto: string }) {
  const div = document.createElement("div");
  div.className = deVotante ? "chat-message from-user" : "chat-message";
  div.textContent = enlace ? `${texto} ` : texto;
  if (enlace) {
    const a = document.createElement("a");
    a.href = enlace.href;
    a.textContent = enlace.texto;
    div.append(a);
  }
  log.append(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

/** Envía la pregunta; sin sesión la guarda como borrador y lleva al acceso. */
async function preguntar(texto: string) {
  const pregunta = texto.trim();
  if (!pregunta || ocupado) return;
  ocupado = true;
  burbuja(pregunta, true);
  input.value = "";
  const escribiendo = burbuja("Escribiendo…");
  try {
    const respuesta = await enviarConSesion({
      formulario: "chat", campos: { mensaje: pregunta }, idempotencia: crypto.randomUUID(),
      enviar: () => chatRepository.ask(pregunta),
    });
    escribiendo.remove();
    if (!respuesta) return;
    borrar();
    burbuja(respuesta.text, false, respuesta.linkHref && respuesta.linkText ? { href: respuesta.linkHref, texto: respuesta.linkText } : undefined);
    leerEnVozAlta(respuesta.linkText ? `${respuesta.text} ${respuesta.linkText}.` : respuesta.text);
  } catch (error) {
    escribiendo.remove();
    burbuja(errorText(error));
  } finally {
    ocupado = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  void preguntar(input.value);
});
document.querySelectorAll<HTMLButtonElement>("[data-chat]").forEach((boton) =>
  boton.addEventListener("click", () => void preguntar(boton.textContent!)));

const borrador = leer("chat");
if (borrador) {
  input.value = borrador.campos.mensaje ?? "";
  document.querySelector<HTMLElement>("#chat-recuperada")!.hidden = false;
}


const sintesis = "speechSynthesis" in window ? window.speechSynthesis : null;
const leerPreferencia = () => { try { return localStorage.getItem(PREFERENCIA); } catch { return null; } };

function activarVoz(activa: boolean, recordar = true) {
  voz.setAttribute("aria-pressed", String(activa));
  voz.querySelector<HTMLElement>(".voz-activa")!.hidden = !activa;
  voz.querySelector<HTMLElement>(".voz-silencio")!.hidden = activa;
  if (!activa) sintesis?.cancel();
  if (recordar) try { localStorage.setItem(PREFERENCIA, String(activa)); } catch { /* solo se pierde la preferencia */ }
}

function leerEnVozAlta(texto: string) {
  if (!sintesis || voz.getAttribute("aria-pressed") !== "true") return;
  sintesis.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = "es-EC";
  sintesis.speak(frase);
}

if (sintesis) {
  voz.hidden = false;
  activarVoz(leerPreferencia() === "true", false);
  voz.addEventListener("click", () => activarVoz(voz.getAttribute("aria-pressed") !== "true"));
}


type Reconocimiento = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const Motor = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as (new () => Reconocimiento) | undefined;

if (Motor) {
  mic.hidden = false;
  let reconocimiento: Reconocimiento | null = null;
  let final = "";
  const detener = () => {
    mic.setAttribute("aria-pressed", "false");
    mic.setAttribute("aria-label", "Preguntar con tu voz");
    escuchando.hidden = true;
    reconocimiento = null;
  };
  mic.addEventListener("click", () => {
    if (reconocimiento) return reconocimiento.stop();
    sintesis?.cancel();
    // Quien pregunta por voz la primera vez seguramente quiere oír la respuesta.
    if (sintesis && leerPreferencia() === null) activarVoz(true);
    final = "";
    reconocimiento = new Motor();
    reconocimiento.lang = "es-EC";
    reconocimiento.interimResults = true;
    reconocimiento.continuous = false;
    reconocimiento.onresult = (e) => {
      const partes = Array.from(e.results);
      input.value = partes.map((r) => r[0].transcript).join("");
      final = partes.filter((r) => r.isFinal).map((r) => r[0].transcript).join("");
    };
    reconocimiento.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed")
        burbuja("Para preguntar con tu voz, permite el uso del micrófono en tu navegador.");
    };
    reconocimiento.onend = () => {
      detener();
      if (final.trim()) void preguntar(final);
    };
    mic.setAttribute("aria-pressed", "true");
    mic.setAttribute("aria-label", "Dejar de escuchar");
    escuchando.hidden = false;
    reconocimiento.start();
  });
}
