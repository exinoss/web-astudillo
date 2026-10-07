// Lo usan el backend para validar y normalizar el enlace, y el frontend para montar el reproductor.

export type VideoProvider = 'youtube' | 'facebook' | 'tiktok' | 'vimeo' | 'mp4';

export interface VideoSource {
  provider: VideoProvider;
  /** Enlace normalizado: es lo que se guarda. */
  url: string;
  /** Dirección del reproductor oficial, o del archivo en el caso de un MP4. */
  embed: string;
  /** Formato habitual del enlace; el panel permite corregirlo. */
  vertical: boolean;
}

export const VIDEO_URL_MAX = 500;
export const PROVIDER_NAMES: Record<VideoProvider, string> = {
  youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok', vimeo: 'Vimeo', mp4: 'el enlace',
};

const host = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m|web|mobile)\./, '');

/** Reconoce un enlace de video admitido; null si no es de un proveedor admitido o no es seguro. */
export function videoSource(value: string): VideoSource | null {
  const text = value.trim();
  if (!text || text.length > VIDEO_URL_MAX) return null;
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const name = host(url);
  const path = url.pathname.split('/').filter(Boolean);

  if (name === 'youtube.com' || name === 'youtu.be') {
    const short = path[0] === 'shorts';
    const id = name === 'youtu.be' ? path[0] : short || path[0] === 'embed' || path[0] === 'live' ? path[1] : url.searchParams.get('v');
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    return {
      provider: 'youtube', vertical: short,
      url: short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
    };
  }
  if (name === 'facebook.com') {
    const reel = path[0] === 'reel' && /^\d{5,25}$/.test(path[1] ?? '');
    const watch = path[0] === 'watch' && /^\d{5,25}$/.test(url.searchParams.get('v') ?? '');
    // /<página>/videos/<id> y la forma antigua /<página>/videos/<título>/<id>.
    const video = (path.length === 3 || path.length === 4) && path[1] === 'videos'
      && /^[\w.-]{1,100}$/.test(path[0]) && /^\d{5,25}$/.test(path.at(-1)!);
    if (!reel && !watch && !video) return null;
    const href = reel ? `https://www.facebook.com/reel/${path[1]}/`
      : watch ? `https://www.facebook.com/watch/?v=${url.searchParams.get('v')}`
      : `https://www.facebook.com/${path.join('/')}/`;
    const size = reel ? 'width=267&height=476' : 'width=560&height=315';
    return {
      provider: 'facebook', vertical: reel, url: href,
      embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false&autoplay=true&${size}`,
    };
  }
  if (name === 'tiktok.com') {
    const valid = path.length === 3 && /^@[\w.]{2,40}$/.test(path[0]) && path[1] === 'video' && /^\d{10,25}$/.test(path[2]);
    if (!valid) return null;
    return {
      provider: 'tiktok', vertical: true, url: `https://www.tiktok.com/${path.join('/')}`,
      embed: `https://www.tiktok.com/player/v1/${path[2]}?autoplay=1&rel=0`,
    };
  }
  if (name === 'vimeo.com' || name === 'player.vimeo.com') {
    const index = path.findIndex(part => /^\d{5,12}$/.test(part));
    if (index < 0) return null;
    const id = path[index];
    const hash = url.searchParams.get('h') ?? path[index + 1];
    const privateHash = hash && /^[a-f0-9]{6,20}$/i.test(hash) ? hash : null;
    return {
      provider: 'vimeo', vertical: false,
      url: `https://vimeo.com/${id}${privateHash ? `/${privateHash}` : ''}`,
      embed: `https://player.vimeo.com/video/${id}?autoplay=1${privateHash ? `&h=${privateHash}` : ''}`,
    };
  }
  if (/\.mp4$/i.test(url.pathname)) {
    url.hash = '';
    return { provider: 'mp4', vertical: false, url: url.href, embed: url.href };
  }
  return null;
}

const SHORT_LINK = 'Es un enlace corto para compartir y no se puede reproducir en la página. Ábrelo en el navegador y copia el enlace de la barra de direcciones';

/** Mensaje para el panel y la API cuando el enlace no es admitido; explica los enlaces cortos de compartir. */
export function videoLinkProblem(value: string) {
  let url: URL | null = null;
  try { url = new URL(value.trim()); } catch { url = null; }
  const name = url ? host(url) : '';
  const path = url?.pathname.split('/').filter(Boolean) ?? [];
  if (name === 'facebook.com' && path[0] === 'share' || name === 'fb.watch')
    return `${SHORT_LINK}: empieza por facebook.com/reel/ o contiene /videos/.`;
  if (name === 'vm.tiktok.com' || name === 'vt.tiktok.com' || (name === 'tiktok.com' && path[0] === 't'))
    return `${SHORT_LINK}: tiene la forma tiktok.com/@usuario/video/…`;
  return 'Pega el enlace de un video de Facebook, TikTok, YouTube o Vimeo.';
}
