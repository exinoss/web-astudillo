// Lo usan el backend para validar los enlaces y el frontend para pintarlos (portada, SEO y aviso legal).

export const REDES_SOCIALES = {
  facebook: { clave: 'enlace.facebook', nombre: 'Facebook', hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com'] },
  instagram: { clave: 'enlace.instagram', nombre: 'Instagram', hosts: ['instagram.com', 'www.instagram.com'] },
  tiktok: { clave: 'enlace.tiktok', nombre: 'TikTok', hosts: ['tiktok.com', 'www.tiktok.com'] },
} as const;

export type RedSocial = keyof typeof REDES_SOCIALES;

/** El enlace si es https a un dominio de la red y sin credenciales; si no, null. */
export function enlaceRed(red: RedSocial, valor: string): URL | null {
  let url: URL;
  try { url = new URL(valor.trim()); } catch { return null; }
  const valido = url.protocol === 'https:' && (REDES_SOCIALES[red].hosts as readonly string[]).includes(url.hostname)
    && !url.username && !url.password && valor.trim().length <= 300;
  return valido ? url : null;
}

// Rutas de las redes que no son el nombre de una cuenta.
const NO_USUARIO = /^(profile\.php|people|pages|groups|p|reel|reels|share|watch|video|videos|explore)$/i;

/** «@usuario» sacado del enlace del perfil; null si el enlace no lo lleva (por ejemplo, profile.php?id=…). */
export function usuarioRed(red: RedSocial, valor: string): string | null {
  const primero = enlaceRed(red, valor)?.pathname.split('/').filter(Boolean)[0];
  if (!primero || NO_USUARIO.test(primero)) return null;
  const nombre = decodeURIComponent(primero).replace(/^@/, '');
  return /^[\w.]{1,60}$/.test(nombre) ? `@${nombre}` : null;
}
