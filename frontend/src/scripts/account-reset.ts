import { authRepository } from '../lib/data/auth';
import { errorText, readToken, showStatus, validateFields, value } from '../lib/auth/page';

const form = document.querySelector<HTMLFormElement>('#reset-form')!;
const status = document.querySelector<HTMLElement>('#account-status')!;
const done = document.querySelector<HTMLElement>('#reset-done')!;
const token = readToken();

if (!token) {
  form.hidden = true;
  showStatus(status, 'El enlace para restablecer la contraseña no es válido.', true);
}

// Envía la contraseña nueva con el token de un solo uso del enlace.
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!token) return;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  try {
    if (!validateFields(form)) {
      showStatus(status, 'Revisa los campos marcados.', true);
      return;
    }
    const contrasenia = value(form, 'contrasenia');
    await authRepository.resetPassword(token, contrasenia);
    form.hidden = true;
    done.hidden = false;
    showStatus(status, 'Contraseña actualizada. Inicia sesión de nuevo.');
  } catch (error) {
    showStatus(status, errorText(error), true);
  } finally {
    submit.disabled = false;
  }
});
