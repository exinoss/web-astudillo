import { authRepository } from '../../lib/data/auth';
import { showFormError } from '../../lib/cuenta/auth/bloqueo';
import { showStatus, validateFields, value } from '../../lib/cuenta/auth/page';
import { enviarConCarga } from '../../lib/comun/cambios';

const form = document.querySelector<HTMLFormElement>('#recovery-form')!;
const status = document.querySelector<HTMLElement>('#account-status')!;
const presetEmail = new URLSearchParams(location.search).get('correo');
if (presetEmail) form.querySelector<HTMLInputElement>('input[name="correo"]')!.value = presetEmail.slice(0, 320);

// Solicita recuperación con una respuesta que no revela si existe la cuenta.
form.addEventListener('submit', event => {
  event.preventDefault();
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  void enviarConCarga(submit, form, async () => {
    try {
      if (!validateFields(form)) {
        showStatus(status, 'Escribe un correo válido.', true);
        return;
      }
      await authRepository.requestReset(value(form, 'correo'));
      form.hidden = true;
      showStatus(status, 'Si existe una cuenta con contraseña, recibirás un enlace para restablecerla.');
    } catch (error) {
      showFormError(status, error, submit);
    }
  });
});
