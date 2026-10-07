import { errorText, showStatus } from '../../lib/cuenta/auth/page';
import { mostrarCarga } from '../../lib/comun/animaciones';
import { adminApi, type PreviewState } from '../../lib/data/http/admin-api';
import { ApiError } from '../../lib/data/http/api-client';

const POLL_MS = 2000;
const TIMEOUT_MS = 5 * 60_000;
// Solo rutas del propio sitio: «//otro.sitio» o «/\otro.sitio» los navegadores los tratan como otro dominio.
const SITE_PATH = /^\/(?![\/\\])[^\s\\]*$/;

const status = document.querySelector<HTMLElement>('#account-status')!;
const retry = document.querySelector<HTMLButtonElement>('#vista-previa-reintentar')!;
const requested = new URLSearchParams(location.search).get('ruta') ?? '';
const path = SITE_PATH.test(requested) ? requested : '/';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function open() {
  retry.hidden = true;
  showStatus(status, 'Preparando la vista previa…');
  const stopLoading = mostrarCarga(status.closest('section')!, 'Preparando la vista previa…');
  try {
    let estado: PreviewState | null = (await adminApi.requestPreview()).estado;
    for (const deadline = Date.now() + TIMEOUT_MS; estado === 'en_cola' || estado === 'compilando';) {
      if (Date.now() > deadline) break;
      await wait(POLL_MS);
      ({ estado } = await adminApi.previewState());
    }
    if (estado !== 'lista') throw new Error('No se pudo preparar la vista previa. Inténtalo de nuevo.');
    await adminApi.enterPreview();
    location.replace(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return location.assign('/cuenta/');
    const denied = error instanceof ApiError && error.status === 403;
    showStatus(status, denied ? 'No tienes permiso para ver esta página.' : errorText(error), true);
    retry.hidden = denied;
  } finally {
    stopLoading();
  }
}

retry.addEventListener('click', () => void open());
void open();
