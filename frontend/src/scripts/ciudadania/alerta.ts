import { mostrarCarga } from "../../lib/comun/animaciones";
import { errorText, showStatus } from "../../lib/cuenta/auth/page";
import { alertRepository } from "../../lib/data/participation";
import type { AlertType, SentAlert } from "../../lib/data/types";
import { esc } from "../../lib/comun/html";
import { iconSvg } from "../../lib/comun/iconos";
import { borrar, leer, leerFoto } from "../../lib/ciudadania/participacion/borrador";
import { enviarConSesion, marcarError } from "../../lib/ciudadania/participacion/envio";
import { prepararAceptacion } from '../../lib/ciudadania/participacion/aceptacion';
import { cuadroIcono, filaHistorial, historial } from "../../lib/ciudadania/participacion/historial";
import { MAX_FOTO_BYTES, MIN_DESCRIPCION, TIPOS_ALERTA } from "../../lib/ciudadania/participacion/tipos";

const form = document.querySelector<HTMLFormElement>("#alerta-form")!;
const tipos = form.querySelector<HTMLFieldSetElement>("#alerta-tipo")!;
const sector = form.querySelector<HTMLInputElement>("#alerta-sector")!;
const referencia = form.querySelector<HTMLInputElement>("#alerta-referencia")!;
const descripcion = form.querySelector<HTMLTextAreaElement>("#alerta-descripcion")!;
const fotoInput = form.querySelector<HTMLInputElement>("#alerta-foto")!;
const fotoZona = form.querySelector<HTMLElement>("#alerta-foto-zona")!;
const fotoVista = form.querySelector<HTMLElement>("#alerta-foto-vista")!;
const estado = form.querySelector<HTMLElement>("#alerta-estado")!;
prepararAceptacion(form);
let enviando = false;

let foto: File | null = null;
let vistaUrl = "";
// Clave del envío en curso: se conserva entre reintentos para que la API no lo duplique.
let idempotencia = "";

const tipoElegido = () => form.querySelector<HTMLInputElement>('input[name="tipo"]:checked')?.value as AlertType | undefined;

/** Muestra u oculta la vista previa; la foto vive en una variable para poder restaurarla del borrador. */
function ponerFoto(archivo: File | null) {
  foto = archivo;
  if (vistaUrl) URL.revokeObjectURL(vistaUrl);
  vistaUrl = archivo ? URL.createObjectURL(archivo) : "";
  fotoVista.querySelector("img")!.src = vistaUrl;
  fotoVista.querySelector("#alerta-foto-nombre")!.textContent = archivo
    ? `${archivo.name} · ${(archivo.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : "";
  fotoVista.hidden = !archivo;
  fotoZona.hidden = !!archivo;
  fotoInput.value = "";
}

fotoInput.addEventListener("change", () => {
  const archivo = fotoInput.files?.[0] ?? null;
  marcarError(fotoInput, null);
  if (!archivo) return;
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) return marcarError(fotoInput, "Elige una foto JPG, PNG o WebP.");
  if (archivo.size > MAX_FOTO_BYTES) return marcarError(fotoInput, "La foto supera los 5 MB. Elige otra o tómala con menos resolución.");
  ponerFoto(archivo);
});
fotoVista.querySelector("img")!.addEventListener("error", () => {
  if (!foto) return;
  ponerFoto(null);
  marcarError(fotoInput, "No se pudo abrir esta foto. Elige otra.");
});
form.querySelector("#alerta-foto-quitar")!.addEventListener("click", () => {
  ponerFoto(null);
  fotoInput.focus();
});
addEventListener("pagehide", () => vistaUrl && URL.revokeObjectURL(vistaUrl));

/** Valida antes de enviar; marca cada campo con su mensaje y devuelve el primero con error. */
function validar() {
  const errores: [HTMLElement, string | null][] = [
    [tipos, tipoElegido() ? null : "Elige el tipo de problema."],
    [sector, sector.value.trim() ? null : "Indica el sector o barrio."],
    [descripcion, Array.from(descripcion.value.trim()).length >= MIN_DESCRIPCION
      ? null : `Describe lo que ocurre con al menos ${MIN_DESCRIPCION} caracteres.`],
  ];
  for (const [campo, mensaje] of errores) marcarError(campo, mensaje);
  return errores.find(([, mensaje]) => mensaje)?.[0];
}
for (const campo of [sector, descripcion]) campo.addEventListener("input", () => campo.hasAttribute("aria-invalid") && marcarError(campo, null));
tipos.addEventListener("change", () => marcarError(tipos, null));

const cargarHistorial = historial(document.querySelector<HTMLElement>("#historial")!, {
  cargar: () => alertRepository.mine(),
  vacio: "Aún no has enviado alertas.",
  icono: "alert",
  sinSesion: "Inicia sesión para ver tus alertas.",
  fila: (a: SentAlert) => {
    const tipo = TIPOS_ALERTA.find((t) => t.valor === a.tipo)!;
    return filaHistorial({
      miniatura: a.foto
        ? `<img class="size-14 rounded-[4px] object-cover" src="${esc(a.foto.miniatura)}" alt="Foto de la alerta" loading="lazy" />`
        : cuadroIcono(tipo.icono),
      titulo: `${iconSvg(tipo.icono, 18)} ${esc(tipo.nombre)}`,
      estado: a.estado, texto: `${a.sector} · ${a.descripcion}`, creadoEn: a.creadoEn,
    });
  },
});

/** Rellena el formulario con lo que el votante escribió antes de iniciar sesión. */
async function recuperarBorrador() {
  const borrador = leer("alerta");
  if (!borrador) return;
  const { campos } = borrador;
  form.querySelector<HTMLInputElement>(`input[name="tipo"][value="${CSS.escape(campos.tipo ?? "")}"]`)?.click();
  sector.value = campos.sector ?? "";
  referencia.value = campos.referencia ?? "";
  descripcion.value = campos.descripcion ?? "";
  idempotencia = borrador.idempotencia;
  if (borrador.conFoto) {
    const guardada = await leerFoto();
    if (guardada) ponerFoto(guardada);
    else marcarError(fotoInput, "No pudimos recuperar la foto. Vuelve a elegirla si quieres enviarla.");
  }
  form.querySelector<HTMLElement>("#alerta-recuperada")!.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (enviando) return;
  const primero = validar();
  if (primero) {
    showStatus(estado, "Revisa los campos marcados.", true);
    (primero === tipos ? tipos.querySelector("input") : primero)?.focus();
    return;
  }
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  enviando = true;
  boton.disabled = true;
  estado.hidden = true;
  idempotencia ||= crypto.randomUUID();
  const campos = { tipo: tipoElegido()!, sector: sector.value.trim(), referencia: referencia.value.trim(), descripcion: descripcion.value.trim() };
  const terminarCarga = mostrarCarga(form);
  try {
    const enviada = await enviarConSesion({
      form, formulario: "alerta", campos, idempotencia, foto: foto ?? undefined,
      enviar: () => alertRepository.submit({ ...campos, tipo: campos.tipo as AlertType, idempotencia, foto: foto ?? undefined }),
    });
    if (!enviada) return;
    borrar();
    idempotencia = "";
    form.reset();
    ponerFoto(null);
    form.querySelector<HTMLElement>("#alerta-recuperada")!.hidden = true;
    showStatus(estado, "Gracias. Recibimos tu alerta; sigue su estado en «Tus alertas».");
    void cargarHistorial();
  } catch (error) {
    showStatus(estado, errorText(error), true);
  } finally {
    terminarCarga();
    enviando = false;
    boton.disabled = false;
  }
});

void recuperarBorrador();
