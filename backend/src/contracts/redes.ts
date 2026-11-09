// Lo usan el backend para validar los enlaces y el frontend para pintarlos (portada, SEO y aviso legal).

export const REDES_SOCIALES = {
  facebook: { clave: 'enlace.facebook', nombre: 'Facebook', hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com'] },
  instagram: { clave: 'enlace.instagram', nombre: 'Instagram', hosts: ['instagram.com', 'www.instagram.com'] },
  tiktok: { clave: 'enlace.tiktok', nombre: 'TikTok', hosts: ['tiktok.com', 'www.tiktok.com'] },
} as const;

export type RedSocial = keyof typeof REDES_SOCIALES;
export const MAX_ENLACE_RED = 300;

/** El enlace si es https a un dominio de la red y sin credenciales; si no, null. */
export function enlaceRed(red: RedSocial, valor: string): URL | null {
  let url: URL;
  try { url = new URL(valor.trim()); } catch { return null; }
  const valido = url.protocol === 'https:' && (REDES_SOCIALES[red].hosts as readonly string[]).includes(url.hostname)
    && !url.username && !url.password && valor.trim().length <= MAX_ENLACE_RED;
  return valido ? url : null;
}

/** Número de WhatsApp como lo escribe una persona (0985658595, +593 98 565 8595) en formato 593…, el que espera wa.me. */
export const normalizarWhatsapp = (texto: string) =>
  texto.trim().replace(/[\s().-]/g, '').replace(/^\+/, '').replace(/^0(?=\d{9}$)/, '593');

/** Indica si un número ya normalizado tiene el largo de un número internacional. */
export const whatsappValido = (numero: string) => /^\d{10,15}$/.test(numero);

// Rutas de las redes que no son el nombre de una cuenta.
const NO_USUARIO = /^(profile\.php|people|pages|groups|p|reel|reels|share|watch|video|videos|explore)$/i;

/** «@usuario» sacado del enlace del perfil; null si el enlace no lo lleva (por ejemplo, profile.php?id=…). */
export function usuarioRed(red: RedSocial, valor: string): string | null {
  const primero = enlaceRed(red, valor)?.pathname.split('/').filter(Boolean)[0];
  if (!primero || NO_USUARIO.test(primero)) return null;
  const nombre = decodeURIComponent(primero).replace(/^@/, '');
  return /^[\w.]{1,60}$/.test(nombre) ? `@${nombre}` : null;
}
