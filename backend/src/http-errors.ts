import { ApiError, type ApiErrorDetail } from './http';

const frameworkErrors: Record<string, { status: number; message: string }> = {
  PARSE: { status: 400, message: 'La solicitud tiene un formato inválido' },
  VALIDATION: { status: 422, message: 'Revisa los datos enviados' },
  NOT_FOUND: { status: 404, message: 'No existe una ruta para esta dirección y método' },
};

/** Traduce errores de la API a respuestas HTTP sin exponer detalles internos. */
export function mapHttpError(error: unknown, code: string | number): { status: number; message: string; detail?: ApiErrorDetail } {
  if (error instanceof ApiError) return { status: error.status, message: error.message, detail: error.detail };

  const frameworkError = frameworkErrors[String(code)];
  if (frameworkError) return frameworkError;

  const details = error && typeof error === 'object'
    ? error as { errno?: unknown; code?: unknown; name?: unknown }
    : {};
  const databaseCode = typeof details.errno === 'string' ? details.errno : '';
  const driverCode = typeof details.code === 'string' ? details.code : '';

  if (databaseCode === '23505') {
    return { status: 409, message: 'La operación entra en conflicto con un registro existente' };
  }
  if (databaseCode.startsWith('08') || ['53300', '57P01', '57P02', '57P03'].includes(databaseCode)
    || driverCode.startsWith('ERR_POSTGRES_CONNECTION_')) {
    return { status: 503, message: 'El servicio no está disponible. Inténtalo más tarde' };
  }

  console.error('Error interno', { type: details.name ?? typeof error, code: driverCode || databaseCode || code });
  return { status: 500, message: 'No se pudo completar la solicitud. Inténtalo más tarde' };
}
