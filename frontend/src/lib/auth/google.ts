type CredentialResponse = { credential?: string };

type GoogleSdk = {
  accounts: { id: {
    initialize(options: { client_id: string; callback: (response: CredentialResponse) => void; auto_select: boolean }): void;
    renderButton(element: HTMLElement, options: { type: 'standard'; theme: 'outline'; size: 'large'; width: number }): void;
    disableAutoSelect(): void;
  } };
};

declare global {
  interface Window { google?: GoogleSdk }
}

let loading: Promise<void> | undefined;
let initialized = false;
let receiveCredential: ((credential: string) => void) | undefined;
const observers = new WeakMap<HTMLElement, ResizeObserver>();

/** Carga GIS una sola vez y permite reintentar si falla la descarga. */
function loadGoogle() {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('No se pudo cargar el acceso con Google.'));
    };
    document.head.append(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}

/** Monta el botón oficial GIS y ajusta su ancho al contenedor disponible. */
export async function showGoogleButton(
  element: HTMLElement, onCredential: (credential: string) => void,
) {
  const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error('Google aún no está configurado.');
  await loadGoogle();
  if (!window.google) throw new Error('No se pudo cargar el acceso con Google.');
  receiveCredential = onCredential;
  if (!initialized) {
    window.google.accounts.id.initialize({ client_id: clientId, auto_select: false,
      callback: response => {
        if (response.credential) receiveCredential?.(response.credential);
      },
    });
    initialized = true;
  }
  observers.get(element)?.disconnect();
  let renderedWidth = 0;
  const render = () => {
    const available = element.clientWidth;
    if (available < 200) return;
    const width = Math.min(400, available);
    if (width === renderedWidth) return;
    renderedWidth = width;
    element.replaceChildren();
    window.google!.accounts.id.renderButton(element, {
      type: 'standard', theme: 'outline', size: 'large', width,
    });
  };
  render();
  const observer = new ResizeObserver(render);
  observer.observe(element);
  observers.set(element, observer);
}

/** Desactiva la selección automática de la cuenta Google anterior. */
export function clearGoogleSelection() {
  window.google?.accounts.id.disableAutoSelect();
}
