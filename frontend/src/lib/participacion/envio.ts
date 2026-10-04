import { authRepository } from "../data/auth";
import { prepararAceptacion } from './aceptacion';
import { ApiError } from "../data/http/api-client";
import { guardar, type Formulario } from "./borrador";

export { marcarError } from './campos';

interface Envio<T> {
  form: HTMLFormElement;
  formulario: Formulario;
  campos: Record<string, string>;
  idempotencia: string;
  foto?: File;
  enviar: () => Promise<T>;
  antesDeEnviar?: () => void;
}

/** Sin sesión guarda el borrador y lleva al acceso (devuelve null). La sesión se comprueba antes de subir la foto. */
export async function enviarConSesion<T>(envio: Envio<T>): Promise<T | null> {
  const guardarEnvio = () => guardar({ formulario: envio.formulario, ruta: location.pathname,
    campos: envio.campos, idempotencia: envio.idempotencia }, envio.foto);
  const aAcceso = async () => {
    await guardarEnvio();
    location.assign("/cuenta/");
    return null;
  };
  let confirmandoAceptacion = false;
  try {
    const profile = await authRepository.getProfile();
    confirmandoAceptacion = profile.terminosAceptados !== true;
    if (!await prepararAceptacion(envio.form).confirmar(profile.terminosAceptados)) return null;
    confirmandoAceptacion = false;
    envio.antesDeEnviar?.();
    return await envio.enviar();
  } catch (error) {
    // La sesión pudo vencer entre la comprobación y el envío.
    if (error instanceof ApiError && error.status === 401) return aAcceso();
    if (error instanceof ApiError && error.status === 428) {
      prepararAceptacion(envio.form).solicitar();
      return null;
    }
    if (error instanceof ApiError && error.status === 409 && confirmandoAceptacion) await guardarEnvio();
    throw error;
  }
}
