import { authRepository } from '../lib/data/auth';
import { errorText, readToken, showStatus, signedIn } from '../lib/auth/page';
import { mostrarCarga } from '../lib/animaciones';

const status = document.querySelector<HTMLElement>('#account-status')!;
const token = readToken();

// Enlace de acceso que se envía cuando un correo recibió muchos intentos fallidos desde distintos lugares.
if (!token) {
  showStatus(status, 'El enlace de acceso no es válido. Vuelve a iniciar sesión.', true);
} else {
  showStatus(status, 'Confirmando tu acceso…');
  const terminarCarga = mostrarCarga(status.closest('section')!, 'Confirmando tu acceso…');
  try {
    await authRepository.confirmLogin(token);
    location.replace('/cuenta/');
  } catch (error) {
    // Ya usado (doble clic en el correo) con la sesión iniciada: no es un error.
    if (await signedIn()) location.replace('/cuenta/');
    else showStatus(status, errorText(error), true);
  } finally {
    terminarCarga();
  }
}
