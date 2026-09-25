import { showGoogleButton } from '../lib/auth/google';
import { errorText, readToken, showStatus } from '../lib/auth/page';
import { authRepository } from '../lib/data/auth';
import { ApiError } from '../lib/data/http/api-client';

const status = document.querySelector<HTMLElement>('#account-status')!;
const google = document.querySelector<HTMLElement>('#google-confirm-button')!;
const token = readToken();

if (!token) {
  showStatus(status, 'El enlace de confirmación no es válido.', true);
} else {
  showStatus(status, 'Confirmando tu correo…');
  try {
    await authRepository.confirmGoogle(token);
    location.replace('/cuenta/');
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      // Si cambió el navegador, solicita autenticación reciente con la misma cuenta.
      showStatus(status, 'Abre el enlace en el navegador original o confirma otra vez con la misma cuenta Google.');
      google.hidden = false;
      try {
        await showGoogleButton(google, async credential => {
          try {
            await authRepository.confirmGoogle(token, credential);
            location.replace('/cuenta/');
          } catch (failure) {
            showStatus(status, errorText(failure), true);
          }
        });
      } catch (failure) {
        showStatus(status, errorText(failure), true);
      }
    } else showStatus(status, errorText(error), true);
  }
}
