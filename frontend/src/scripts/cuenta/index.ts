import { clearGoogleSelection, showGoogleButton } from '../../lib/cuenta/auth/google';
import { releaseButton, showFormError } from '../../lib/cuenta/auth/bloqueo';
import { setAccountNav } from '../../lib/cuenta/auth/navigation';
import { errorText, showStatus, validateFields, value } from '../../lib/cuenta/auth/page';
import { authRepository } from '../../lib/data/auth';
import type { Profile } from '../../lib/data/auth-repository';
import { ApiError } from '../../lib/data/http/api-client';
import { mostrarCarga } from '../../lib/comun/animaciones';
import { avisoDeAcceso, destinoTrasAcceso } from '../../lib/ciudadania/participacion/borrador';
import { acceptanceOf } from '../../lib/cuenta/auth/acceptance';

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
const googleRegistration = document.querySelector<HTMLElement>('#google-registration-panel')!;
const googleRegistrationForm = document.querySelector<HTMLFormElement>('#google-registration-form')!;
const passwordGoogle = document.querySelector<HTMLElement>('#google-password-button')!;
const passwordGoogleStep = document.querySelector<HTMLElement>('#google-password-step')!;
const passwordGoogleUnavailable = document.querySelector<HTMLElement>('#google-password-unavailable')!;
const loading = document.querySelector<HTMLElement>('#account-loading')!;
let current: Profile | undefined;
let addingPassword = false;
let savingProfile = false;
let googleCredential: string | undefined;
let signingWithGoogle = false;

/** Todo inicio de sesión correcto lleva a la portada o, si quedó un envío a medias, a su formulario. */
const afterLogin = () => location.assign(destinoTrasAcceso());

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
  googleCredential = undefined;
  googleRegistration.hidden = true;
  setAccountNav(false);
  loading.hidden = true;
  heading('Mi cuenta', 'Accede para gestionar tus datos y participar.');
  const aviso = avisoDeAcceso();
  if (aviso) showStatus(status, aviso);
  profilePanel.hidden = true;
  blockedPanel.hidden = true;
  loginPanel.hidden = false;
  loginPanel.classList.remove('invisible');
  try {
    await showGoogleButton(loginGoogle, async credential => {
      if (signingWithGoogle) return;
      signingWithGoogle = true;
      const terminarCarga = mostrarCarga(loginPanel);
      try {
        const pending = await authRepository.googleLogin(credential);
        if (pending) {
          googleCredential = credential;
          googleRegistrationForm.reset();
          status.hidden = true;
          loginPanel.hidden = true;
          googleRegistration.hidden = false;
          document.querySelector<HTMLElement>('#google-registration-name')!.textContent = pending.nombresCompletos ?? '';
          document.querySelector<HTMLElement>('#google-registration-email')!.textContent = pending.correo;
          googleRegistrationForm.querySelector<HTMLInputElement>('input')!.focus();
        } else afterLogin();
      } catch (error) {
        showAccountError(error);
      } finally {
        signingWithGoogle = false;
        terminarCarga();
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
  setAccountNav(true);
  loading.hidden = true;
  heading('Mi perfil', 'Actualiza tus datos y protege el acceso a tu cuenta.');
  loginPanel.hidden = true;
  googleRegistration.hidden = true;
  blockedPanel.hidden = true;
  profilePanel.hidden = false;
  profileForm.querySelector<HTMLInputElement>('[name="nombresCompletos"]')!.value = profile.nombresCompletos ?? '';
  profileForm.querySelector<HTMLInputElement>('[name="direccion"]')!.value = profile.direccion ?? '';
  syncProfileButton();
  document.querySelector<HTMLElement>('#admin-panel-link')!.hidden = !profile.permisos?.includes('contenido.editar');
  passwordPanel.hidden = !profile.tieneGoogle || profile.tieneContrasenia;
  changePasswordPanel.hidden = !profile.tieneContrasenia;
  passwordGoogleStep.hidden = true;
}

async function loadProfile() {
  const profile = await authRepository.getProfile();
  status.hidden = true;
  await showProfile(profile);
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  const terminarCarga = mostrarCarga(loginForm);
  try {
    if (!validateFields(loginForm)) {
      showStatus(status, 'Revisa los campos marcados.', true);
      return;
    }
    const result = await authRepository.login(value(loginForm, 'correo'), value(loginForm, 'contrasenia'));
    if (result === 'link') {
      showStatus(status, 'Por seguridad te enviamos un enlace a tu correo para terminar de entrar. Revisa también la carpeta de spam.');
      return;
    }
    afterLogin();
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) showFormError(status, error, submit, value(loginForm, 'correo'));
    else showAccountError(error);
  } finally {
    terminarCarga();
    releaseButton(submit);
  }
});

googleRegistrationForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!googleCredential || signingWithGoogle || !validateFields(googleRegistrationForm)) return;
  signingWithGoogle = true;
  const button = googleRegistrationForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  button.disabled = true;
  const terminarCarga = mostrarCarga(googleRegistrationForm);
  try {
    const pending = await authRepository.googleLogin(googleCredential, acceptanceOf(googleRegistrationForm)!);
    if (!pending) afterLogin();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await showLogin();
      showStatus(status, 'Vuelve a entrar con Google para continuar.', true);
    } else showStatus(status, errorText(error), true);
  } finally {
    signingWithGoogle = false;
    button.disabled = false;
    terminarCarga();
  }
});

const profileSubmit = profileForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const syncProfileButton = () => {
  profileSubmit.disabled = savingProfile || !current || (value(profileForm, 'nombresCompletos').trim() === (current.nombresCompletos ?? '')
    && value(profileForm, 'direccion').trim() === (current.direccion ?? ''));
};
profileForm.addEventListener('input', syncProfileButton);

profileForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!current || savingProfile) return;
  if (!Number.isInteger(current.versionPerfil) || current.versionPerfil < 1) {
    showStatus(status, 'Recarga la página antes de guardar tus datos.', true);
    return;
  }
  savingProfile = true;
  profileSubmit.disabled = true;
  const terminarCarga = mostrarCarga(profileForm);
  try {
    if (!validateFields(profileForm)) {
      showStatus(status, 'Revisa los campos marcados.', true);
      return;
    }
    const updated = await authRepository.updateProfile({
      nombresCompletos: value(profileForm, 'nombresCompletos'),
      direccion: value(profileForm, 'direccion'),
      versionPerfil: current.versionPerfil,
    });
    current = { ...current, ...updated };
    showStatus(status, 'Datos guardados.');
  } catch (error) {
    showStatus(status, errorText(error), true);
  } finally {
    terminarCarga();
    savingProfile = false;
    syncProfileButton();
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
  const terminarCarga = mostrarCarga(passwordForm);
  try {
    await authRepository.addPassword(credential, value(passwordForm, 'contrasenia'));
    passwordForm.reset();
    const updated = await authRepository.getProfile();
    await showProfile(updated);
    showStatus(status, 'Contraseña agregada. Ya puedes entrar también con tu correo.');
  } catch (error) {
    showStatus(status, errorText(error), true);
  } finally {
    addingPassword = false;
    terminarCarga();
    submit.disabled = false;
  }
}

passwordForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!validateFields(passwordForm)) {
    showStatus(status, 'Revisa los campos marcados.', true);
    return;
  }
  await confirmGoogleForPassword();
});

// Cambia la contraseña y fuerza un nuevo inicio de sesión tras la rotación.
changePasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = changePasswordForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  const terminarCarga = mostrarCarga(changePasswordForm);
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
    showFormError(status, error, submit);
  } finally {
    terminarCarga();
    releaseButton(submit);
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

const terminarCargaInicial = mostrarCarga(loading, 'Cargando tu cuenta…');
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
} finally {
  terminarCargaInicial();
}
