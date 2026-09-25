export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let renewal: Promise<boolean> | undefined;

/** Comparte una sola renovación entre solicitudes protegidas simultáneas. */
function renew() {
  renewal ??= fetch('/api/auth/refresh', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
  }).then(response => response.ok).catch(() => false).finally(() => { renewal = undefined; });
  return renewal;
}

/** Envía solicitudes con cookies y reintenta una vez tras renovar la sesión. */
export async function apiRequest<T>(
  path: string, method = 'GET', body?: object, retryAfterRenewal = false,
): Promise<T> {
  const send = () => fetch(path, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let response: Response;
  try {
    response = await send();
    if (response.status === 401 && retryAfterRenewal && await renew()) response = await send();
  } catch {
    throw new ApiError(0, 'No se pudo conectar. Inténtalo de nuevo.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = typeof data?.error === 'string' ? data.error : 'No se pudo completar la solicitud.';
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}
