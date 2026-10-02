import { signedIn } from "../auth/page";
import { ApiError } from "../data/http/api-client";
import { guardar, type Formulario } from "./borrador";

/** Marca o limpia el error de un campo (o grupo de botones) y su texto asociado `#<id>-error`. */
export function marcarError(campo: HTMLElement, mensaje: string | null) {
  if (mensaje) campo.setAttribute("aria-invalid", "true");
  else campo.removeAttribute("aria-invalid");
  const error = document.getElementById(`${campo.id}-error`);
  if (error) {
    error.textContent = mensaje ?? "";
    error.hidden = !mensaje;
  }
}

interface Envio<T> {
  formulario: Formulario;
  campos: Record<string, string>;
  idempotencia: string;
  foto?: File;
  enviar: () => Promise<T>;
}

/** Sin sesión guarda el borrador y lleva al acceso (devuelve null). La sesión se comprueba antes de subir la foto. */
export async function enviarConSesion<T>(envio: Envio<T>): Promise<T | null> {
  const aAcceso = async () => {
    await guardar({ formulario: envio.formulario, ruta: location.pathname, campos: envio.campos, idempotencia: envio.idempotencia }, envio.foto);
    location.assign("/cuenta/");
    return null;
  };
  if (!(await signedIn())) return aAcceso();
  try {
    return await envio.enviar();
  } catch (error) {
    // La sesión pudo vencer entre la comprobación y el envío.
    if (error instanceof ApiError && error.status === 401) return aAcceso();
    throw error;
  }
}
