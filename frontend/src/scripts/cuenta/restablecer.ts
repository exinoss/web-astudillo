import { authRepository } from '../../lib/data/auth';
import { errorText, readToken, showStatus, validateFields, value } from '../../lib/cuenta/auth/page';
import { enviarConCarga } from '../../lib/comun/cambios';

const form = document.querySelector<HTMLFormElement>('#reset-form')!;
const status = document.querySelector<HTMLElement>('#account-status')!;
const done = document.querySelector<HTMLElement>('#reset-done')!;
const token = readToken();

if (!token) {
  form.hidden = true;
  showStatus(status, 'El enlace para restablecer la contraseña no es válido.', true);
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!token) return;
  void enviarConCarga(form.querySelector<HTMLButtonElement>('button[type="submit"]')!, form, async () => {
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
    }
  });
});
