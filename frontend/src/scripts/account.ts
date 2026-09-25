import { clearGoogleSelection, showGoogleButton } from '../lib/auth/google';
import { setAccountNav } from '../lib/auth/navigation';
import { errorText, showStatus, validateFields, value } from '../lib/auth/page';
import { authRepository } from '../lib/data/auth';
import type { Profile } from '../lib/data/auth-repository';
import { ApiError } from '../lib/data/http/api-client';

const loginPanel = document.querySelector<HTMLElement>('#login-panel')!;
const profilePanel = document.querySelector<HTMLElement>('#profile-panel')!;
const blockedPanel = document.querySelector<HTMLElement>('#blocked-panel')!;
const loginForm = document.querySelector<HTMLFormElement>('#login-form')!;
const profileForm = document.querySelector<HTMLFormElement>('#profile-form')!;
const passwordForm = document.querySelector<HTMLFormElement>('#add-password-form')!;
const passwordPanel = document.querySelector<HTMLElement>('#add-password-panel')!;
const changePasswordForm = document.querySelector<HTMLFormElement>('#change-password-form')!;
const changePasswordPanel = document.querySelector<HTMLElement>('#change-password-panel')!;
const status = document.querySelector<HTMLElement>('#account-status')!;
const loginGoogle = document.querySelector<HTMLElement>('#google-login-button')!;
const passwordGoogle = document.querySelector<HTMLElement>('#google-password-button')!;
const passwordGoogleStep = document.querySelector<HTMLElement>('#google-password-step')!;
const passwordGoogleUnavailable = document.querySelector<HTMLElement>('#google-password-unavailable')!;
const loading = document.querySelector<HTMLElement>('#account-loading')!;
let current: Profile | undefined;
let recentGoogle: { credential: string; until: number } | undefined;
let addingPassword = false;

/** Sincroniza título, encabezado y ruta visible de la página de cuenta. */
function heading(title: string, lead: string) {
  document.title = `${title} · Carlos Astudillo`;
  document.querySelector<HTMLElement>('#account-title')!.textContent = title;
  document.querySelector<HTMLElement>('#account-crumb')!.textContent = title;
  document.querySelector<HTMLElement>('#account-lead')!.textContent = lead;
}

/** Presenta errores de sesión y bloquea la vista si el permiso fue revocado. */
function showAccountError(error: unknown) {
  loading.hidden = true;
  if (error instanceof ApiError && error.status === 403) {
    recentGoogle = undefined;
    setAccountNav(true);
    loginPanel.hidden = true;
    profilePanel.hidden = true;
    blockedPanel.hidden = false;
    showStatus(status, 'Tu cuenta no tiene permiso para ver el perfil.', true);
  } else showStatus(status, errorText(error), true);
}

/** Prepara el acceso por contraseña y Google cuando no hay perfil cargado. */
async function showLogin() {
  current = undefined;
  recentGoogle = undefined;
  setAccountNav(false);
  loading.hidden = true;
  heading('Mi cuenta', 'Accede para gestionar tus datos y participar.');
  profilePanel.hidden = true;
  blockedPanel.hidden = true;
  loginPanel.hidden = false;
  try {
    await showGoogleButton(loginGoogle, async credential => {
      try {
        const result = await authRepository.googleLogin(credential);
        if (result === 'pending') {
          showStatus(status, 'Enviamos un enlace a tu correo para confirmar esta cuenta Google.');
        } else {
          recentGoogle = { credential, until: Date.now() + 4 * 60_000 };
          await loadProfile();
        }
      } catch (error) {
        showAccountError(error);
      }
    });
  } catch (error) {
    loginGoogle.hidden = true;
    document.querySelector<HTMLElement>('#google-login-unavailable')!.hidden = false;
  }
}

/** Rellena el perfil y muestra controles según sus métodos de autenticación. */
async function showProfile(profile: Profile) {
  current = profile;
  if (!profile.tieneGoogle || profile.tieneContrasenia) recentGoogle = undefined;
  setAccountNav(true);
  loading.hidden = true;
  heading('Mi perfil', 'Actualiza tus datos y protege el acceso a tu cuenta.');
  loginPanel.hidden = true;
  blockedPanel.hidden = true;
  profilePanel.hidden = false;
  profileForm.querySelector<HTMLInputElement>('[name="nombresCompletos"]')!.value = profile.nombresCompletos ?? '';
  profileForm.querySelector<HTMLInputElement>('[name="direccion"]')!.value = profile.direccion ?? '';
  passwordPanel.hidden = !profile.tieneGoogle || profile.tieneContrasenia;
  changePasswordPanel.hidden = !profile.tieneContrasenia;
  passwordGoogleStep.hidden = true;
}

/** Obtiene el perfil autenticado y lo aplica a la pantalla. */
async function loadProfile() {
  const profile = await authRepository.getProfile();
  status.hidden = true;
  await showProfile(profile);
}

// Valida credenciales, inicia sesión y carga el perfil devuelto por la API.
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  try {
    if (!validateFields(loginForm)) {
      showStatus(status, 'Revisa los campos marcados.', true);
      return;
    }
    await authRepository.login(value(loginForm, 'correo'), value(loginForm, 'contrasenia'));
    await loadProfile();
  } catch (error) {
    showAccountError(error);
  } finally {
    submit.disabled = false;
  }
});

// Envía únicamente nombre y dirección, los campos editables del perfil.
profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!current) return;
  const submit = profileForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  try {
    if (!validateFields(profileForm)) {
      showStatus(status, 'Revisa los campos marcados.', true);
      return;
    }
    const updated = await authRepository.updateProfile({
      nombresCompletos: value(profileForm, 'nombresCompletos'),
      direccion: value(profileForm, 'direccion'),
    });
    current = { ...current, ...updated };
    showStatus(status, 'Datos guardados.');
  } catch (error) {
    showStatus(status, errorText(error), true);
  } finally {
    submit.disabled = false;
  }
});

/** Solicita una autenticación Google reciente antes de añadir contraseña. */
async function confirmGoogleForPassword() {
  passwordGoogleStep.hidden = false;
  passwordGoogle.hidden = false;
  passwordGoogleUnavailable.hidden = true;
  try {
    await showGoogleButton(passwordGoogle, credential => void saveGooglePassword(credential));
  } catch {
    passwordGoogle.hidden = true;
    passwordGoogleUnavailable.hidden = false;
  }
}

/** Añade la contraseña y actualiza los métodos de acceso del perfil. */
async function saveGooglePassword(credential: string) {
  if (addingPassword) return;
  if (!validateFields(passwordForm)) {
    showStatus(status, 'Revisa los campos marcados.', true);
    return;
  }
  addingPassword = true;
  const submit = passwordForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  try {
    await authRepository.addPassword(credential, value(passwordForm, 'contrasenia'));
    recentGoogle = undefined;
    passwordForm.reset();
    const updated = await authRepository.getProfile();
    await showProfile(updated);
    showStatus(status, 'Contraseña agregada. Ya puedes entrar también con tu correo.');
  } catch (error) {
    if (recentGoogle?.credential === credential && error instanceof ApiError && error.status === 401) {
      recentGoogle = undefined;
      await confirmGoogleForPassword();
      showStatus(status, 'Confirma tu cuenta con Google para guardar la contraseña.');
    } else showStatus(status, errorText(error), true);
  } finally {
    addingPassword = false;
    submit.disabled = false;
  }
}

// Reutiliza una credencial Google reciente o pide una nueva confirmación.
passwordForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateFields(passwordForm)) {
    showStatus(status, 'Revisa los campos marcados.', true);
    return;
  }
  const credential = recentGoogle && Date.now() < recentGoogle.until ? recentGoogle.credential : undefined;
  if (credential) await saveGooglePassword(credential);
  else {
    recentGoogle = undefined;
    await confirmGoogleForPassword();
  }
});

// Cambia la contraseña y fuerza un nuevo inicio de sesión tras la rotación.
changePasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = changePasswordForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  try {
    if (!validateFields(changePasswordForm)) {
      showStatus(status, 'Revisa los campos marcados.', true);
      return;
    }
    const contraseniaActual = value(changePasswordForm, 'contraseniaActual');
    const contraseniaNueva = value(changePasswordForm, 'contraseniaNueva');
    const confirmarContrasenia = value(changePasswordForm, 'confirmarContrasenia');
    await authRepository.changePassword({ contraseniaActual, contraseniaNueva, confirmarContrasenia });
    changePasswordForm.reset();
    await showLogin();
    showStatus(status, 'Contraseña actualizada. Inicia sesión de nuevo.');
  } catch (error) {
    showStatus(status, errorText(error), true);
  } finally {
    submit.disabled = false;
  }
});

/** Revoca la sesión y devuelve la pantalla al formulario de acceso. */
async function logout() {
  try {
    await authRepository.logout();
    clearGoogleSelection();
    await showLogin();
    showStatus(status, 'Sesión cerrada.');
  } catch (error) {
    showStatus(status, errorText(error), true);
  }
}

document.querySelector<HTMLButtonElement>('#logout-button')!.addEventListener('click', logout);
document.querySelector<HTMLButtonElement>('#logout-google-button')!.addEventListener('click', logout);
document.querySelector<HTMLButtonElement>('#blocked-logout-button')!.addEventListener('click', logout);

try {
  await loadProfile();
} catch (error) {
  if (error instanceof ApiError && error.status === 401) {
    status.hidden = true;
    await showLogin();
  } else if (error instanceof ApiError && error.status === 403) showAccountError(error);
  else {
    await showLogin();
    showStatus(status, errorText(error), true);
  }
}
