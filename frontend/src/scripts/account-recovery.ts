import { authRepository } from '../lib/data/auth';
import { errorText, showStatus, validateFields, value } from '../lib/auth/page';

const form = document.querySelector<HTMLFormElement>('#recovery-form')!;
const status = document.querySelector<HTMLElement>('#account-status')!;

// Solicita recuperación con una respuesta que no revela si existe la cuenta.
form.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  try {
    if (!validateFields(form)) {
      showStatus(status, 'Escribe un correo válido.', true);
      return;
    }
    await authRepository.requestReset(value(form, 'correo'));
    form.hidden = true;
    showStatus(status, 'Si existe una cuenta con contraseña, recibirás un enlace para restablecerla.');
  } catch (error) {
    showStatus(status, errorText(error), true);
  } finally {
    submit.disabled = false;
  }
});
