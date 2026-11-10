import { t, type Cookie } from 'elysia';
import { isIP } from 'node:net';
import { clearCookie, cookieOptions } from '../../http';
import type { AuthContext as AuthContextType } from '../types';
import { LARGOS } from '../../contracts/limites';
import { strict } from '../../validation/esquemas';
export type { AuthContext } from '../types';
export { strict };

export const email = t.String({ format: 'email', maxLength: LARGOS.cuenta.correo });
export const password = t.String({ minLength: 6, maxLength: LARGOS.cuenta.contrasenia });
export const token = t.String({ pattern: '^[A-Za-z0-9_-]{43}$' });
export const googleCredential = t.String({ minLength: 100 });
export const acceptance = t.Object({ version: t.String({ minLength: 1, maxLength: 32 }), aceptada: t.Literal(true) }, strict);

/** Usa X-Real-IP solo cuando un proxy privado y confiable lo sobrescribe. */
export const ipOf = (
  server: { requestIP(request: Request): { address: string } | null } | null,
  request: Request,
  trustProxyIp = false,
) => {
  const proxyIp = request.headers.get('x-real-ip');
  if (trustProxyIp && proxyIp && isIP(proxyIp)) return proxyIp;
  return server?.requestIP(request)?.address ?? 'unknown';
};

/** Redirige enlaces antiguos a Astro sin consumir el token de verificación. */
export function redirectToAccount(origin: string, path: string, tokenValue: string) {
  const url = new URL(path, origin);
  url.searchParams.set('token', tokenValue);
  return new Response(null, { status: 303, headers: {
    location: url.toString(), 'referrer-policy': 'no-referrer', 'cache-control': 'no-store',
  } });
}

export function clearSession(context: AuthContextType, cookie: Record<string, Cookie<unknown>>) {
  clearCookie(cookie.access, context.config, '/api');
  clearCookie(cookie.refresh, context.config, '/api/auth');
}

/** Guarda JWT y refresh token en cookies con rutas y vencimientos separados. */
export function setSession(context: AuthContextType, cookie: Record<string, Cookie<unknown>>, value: {
  access: string; refresh: string | null;
}) {
  cookie.access.set({ value: value.access, ...cookieOptions(context.config, 600, '/api') });
  // Sin refresh nuevo (renovación simultánea desde otra pestaña) se conserva el que ya tiene el navegador.
  if (value.refresh) cookie.refresh.set({ value: value.refresh,
    ...cookieOptions(context.config, context.sessions.lifetime, '/api/auth') });
}
