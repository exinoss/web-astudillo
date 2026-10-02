import { authRepository } from '../lib/data/auth';
import { errorText, readToken, showStatus } from '../lib/auth/page';
import { mostrarCarga } from '../lib/animaciones';

const status = document.querySelector<HTMLElement>('#account-status')!;
const done = document.querySelector<HTMLElement>('#verify-done')!;
const token = readToken();

if (!token) {
  showStatus(status, 'El enlace de verificación no es válido. Solicita uno nuevo desde el registro.', true);
} else {
  showStatus(status, 'Confirmando tu correo…');
  const terminarCarga = mostrarCarga(status.closest('section')!, 'Confirmando tu correo…');
  try {
    await authRepository.verifyEmail(token);
    showStatus(status, 'Correo confirmado. Ya puedes iniciar sesión.');
    done.hidden = false;
  } catch (error) {
    showStatus(status, errorText(error), true);
  } finally {
    terminarCarga();
  }
}
