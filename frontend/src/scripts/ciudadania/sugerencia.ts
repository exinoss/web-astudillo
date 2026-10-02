import { mostrarCarga } from "../../lib/animaciones";
import { errorText, showStatus } from "../../lib/auth/page";
import { suggestionRepository } from "../../lib/data";
import { borrar, leer } from "../../lib/participacion/borrador";
import { enviarConSesion, marcarError } from "../../lib/participacion/envio";
import { MIN_SUGERENCIA } from "../../lib/participacion/tipos";

const form = document.querySelector<HTMLFormElement>("#sugerencia-form")!;
const temas = form.querySelector<HTMLFieldSetElement>("#sugerencia-tema")!;
const mensaje = form.querySelector<HTMLTextAreaElement>("#sugerencia-mensaje")!;
const estado = form.querySelector<HTMLElement>("#sugerencia-estado")!;
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
  boton.disabled = true;
  estado.hidden = true;
  idempotencia ||= crypto.randomUUID();
  const campos = { tema: temaElegido()!, mensaje: mensaje.value.trim() };
  const terminarCarga = mostrarCarga(form);
  try {
    const enviada = await enviarConSesion({
      formulario: "sugerencia", campos, idempotencia,
      enviar: () => suggestionRepository.submit({ ...campos, idempotencia }),
    });
    if (!enviada) return;
    borrar();
    idempotencia = "";
    form.reset();
    form.querySelector<HTMLElement>("#sugerencia-recuperada")!.hidden = true;
    showStatus(estado, "Gracias por compartir tu idea. Tu voz cuenta.");
  } catch (error) {
    showStatus(estado, errorText(error), true);
  } finally {
    terminarCarga();
    boton.disabled = false;
  }
});
