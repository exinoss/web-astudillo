import { authRepository } from '../lib/data/auth';
import { ApiError } from '../lib/data/http/api-client';
import { errorText, readToken, showStatus, validateFields, value } from '../lib/auth/page';

const status = document.querySelector<HTMLElement>('#account-status')!;
const form = document.querySelector<HTMLFormElement>('#verify-form')!;
const done = document.querySelector<HTMLElement>('#verify-done')!;
const token = readToken();

if (!token) {
  showStatus(status, 'El enlace de verificación no es válido. Solicita uno nuevo desde el registro.', true);
} else {
  showStatus(status, 'Confirmando tu correo…');
  try {
    await authRepository.verifyEmail(token);
    showStatus(status, 'Correo confirmado. Ya puedes iniciar sesión.');
    done.hidden = false;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      showStatus(status, 'Este enlace se abrió en otro navegador. Escribe la contraseña que usaste al registrarte.');
      form.hidden = false;
    } else showStatus(status, errorText(error), true);
  }
}

// Confirma desde otro navegador usando la contraseña original del registro.
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!token) return;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  try {
    if (!validateFields(form)) {
      showStatus(status, 'Escribe la contraseña usada al registrarte.', true);
      return;
    }
    await authRepository.verifyEmail(token, value(form, 'contrasenia'));
    form.hidden = true;
    done.hidden = false;
    showStatus(status, 'Correo confirmado. Ya puedes iniciar sesión.');
  } catch (error) {
    showStatus(status, errorText(error), true);
  } finally {
    submit.disabled = false;
  }
});
