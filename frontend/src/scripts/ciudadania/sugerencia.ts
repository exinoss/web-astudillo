import { mostrarCarga } from "../../lib/comun/animaciones";
import { errorText, showStatus } from "../../lib/cuenta/auth/page";
import { suggestionRepository } from "../../lib/data/participation";
import { borrar, leer } from "../../lib/ciudadania/participacion/borrador";
import { enviarConSesion, marcarError } from "../../lib/ciudadania/participacion/envio";
import { prepararAceptacion } from '../../lib/ciudadania/participacion/aceptacion';
import { MIN_SUGERENCIA } from "../../lib/ciudadania/participacion/tipos";
import { cuadroIcono, filaHistorial, historial } from "../../lib/ciudadania/participacion/historial";
import { esc } from "../../lib/comun/html";
import type { SentSuggestion } from "../../lib/data/types";

const form = document.querySelector<HTMLFormElement>("#sugerencia-form")!;
const temas = form.querySelector<HTMLFieldSetElement>("#sugerencia-tema")!;
const mensaje = form.querySelector<HTMLTextAreaElement>("#sugerencia-mensaje")!;
const estado = form.querySelector<HTMLElement>("#sugerencia-estado")!;
prepararAceptacion(form);
const TEMAS = JSON.parse(form.dataset.temas!) as { valor: string; nombre: string; icono: string }[];
const cargarHistorial = historial(document.querySelector<HTMLElement>("#historial")!, {
  cargar: () => suggestionRepository.mine(),
  vacio: "Aún no has enviado sugerencias.",
  icono: "idea",
  sinSesion: "Inicia sesión para ver tus sugerencias.",
  fila: (s: SentSuggestion) => {
    const tema = TEMAS.find((t) => t.valor === s.tema) ?? TEMAS.at(-1)!;
    return filaHistorial({ miniatura: cuadroIcono(tema.icono), titulo: esc(tema.nombre), estado: s.estado, texto: s.mensaje, creadoEn: s.creadoEn });
  },
});
let enviando = false;
let idempotencia = "";

const marcarTema = (valor: string | null | undefined) =>
  valor && form.querySelector<HTMLInputElement>(`input[name="tema"][value="${CSS.escape(valor)}"]`)?.click();
const temaElegido = () => form.querySelector<HTMLInputElement>('input[name="tema"]:checked')?.value;

// «Compartir una sugerencia» desde una propuesta llega con su tema (?tema=agua-potable).
marcarTema(new URLSearchParams(location.search).get("tema"));
const borrador = leer("sugerencia");
if (borrador) {
  marcarTema(borrador.campos.tema);
  mensaje.value = borrador.campos.mensaje ?? "";
  idempotencia = borrador.idempotencia;
  form.querySelector<HTMLElement>("#sugerencia-recuperada")!.hidden = false;
}

temas.addEventListener("change", () => marcarError(temas, null));
mensaje.addEventListener("input", () => mensaje.hasAttribute("aria-invalid") && marcarError(mensaje, null));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (enviando) return;
  const sinTema = !temaElegido();
  const corto = Array.from(mensaje.value.trim()).length < MIN_SUGERENCIA;
  marcarError(temas, sinTema ? "Elige un tema." : null);
  marcarError(mensaje, corto ? `Escribe tu idea con al menos ${MIN_SUGERENCIA} caracteres.` : null);
  if (sinTema || corto) {
    showStatus(estado, "Revisa los campos marcados.", true);
    (sinTema ? temas.querySelector("input") : mensaje)?.focus();
    return;
  }
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  enviando = true;
  boton.disabled = true;
  estado.hidden = true;
  idempotencia ||= crypto.randomUUID();
  const campos = { tema: temaElegido()!, mensaje: mensaje.value.trim() };
  const terminarCarga = mostrarCarga(form);
  try {
    const enviada = await enviarConSesion({
      form, formulario: "sugerencia", campos, idempotencia,
      enviar: () => suggestionRepository.submit({ ...campos, idempotencia }),
    });
    if (!enviada) return;
    borrar();
    idempotencia = "";
    form.reset();
    form.querySelector<HTMLElement>("#sugerencia-recuperada")!.hidden = true;
    showStatus(estado, "Gracias por compartir tu idea; sigue su estado en «Tus sugerencias».");
    void cargarHistorial();
  } catch (error) {
    showStatus(estado, errorText(error), true);
  } finally {
    terminarCarga();
    enviando = false;
    boton.disabled = false;
  }
});
