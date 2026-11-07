import type { MotivoNoInsertable, VideoSource } from '../../contracts/video';

const TIMEOUT_MS = 8000;
const IMAGE_HOSTS = [/^i\.ytimg\.com$/, /^i\.vimeocdn\.com$/, /\.fbcdn\.net$/, /\.tiktokcdn(-us)?\.com$/];
const PAGE_HOSTS = [/(^|\.)facebook\.com$/, /(^|\.)tiktok\.com$/, /^vimeo\.com$/, /^(www\.)?youtube\.com$/];
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
// Facebook y TikTok solo publican la imagen del video (og:image) para su propio rastreador.
const CRAWLER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const allowed = (url: string, hosts: RegExp[]) => {
  const { protocol, hostname } = new URL(url);
  return protocol === 'https:' && hosts.some(host => host.test(hostname));
};

/** Pide una dirección de los dominios permitidos, con tiempo límite; devuelve la respuesta sea cual sea su código. */
async function request(url: string, hosts: RegExp[], headers: Record<string, string> = {}) {
  if (!allowed(url, hosts)) return null;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  // Las redirecciones no pueden sacar la descarga de los dominios permitidos.
  return allowed(response.url || url, hosts) ? response : null;
}

/** Como `request`, pero solo si la plataforma respondió con éxito. */
async function get(url: string, hosts: RegExp[], headers: Record<string, string> = {}) {
  const response = await request(url, hosts, headers);
  return response?.ok ? response : null;
}

async function image(url: string | undefined, maxBytes: number) {
  if (!url) return null;
  const response = await get(url, IMAGE_HOSTS);
  if (!response || Number(response.headers.get('content-length') ?? 0) > maxBytes) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.length && bytes.length <= maxBytes ? bytes : null;
}

const ogImage = async (pageUrl: string) => {
  const html = await (await get(pageUrl, PAGE_HOSTS, { 'user-agent': CRAWLER }))?.text();
  return html?.match(/<meta property="og:image" content="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
};

/** Por qué la plataforma no deja mostrar el video en el sitio, o `null` si lo deja o no se pudo comprobar. */
export async function videoInsertable(source: VideoSource): Promise<MotivoNoInsertable | null> {
  try {
    if (source.provider === 'facebook') {
      // Solo cuenta su página de reproductor (`body.plugin`) sin video: una de acceso o de error no bloquea.
      const html = await (await get(source.embed, PAGE_HOSTS, { 'user-agent': BROWSER }))?.text();
      return html && /<body[^>]*class="[^"]*\bplugin\b/.test(html) && !/<video\b/.test(html) ? 'bloqueado' : null;
    }
    if (source.provider !== 'youtube' && source.provider !== 'vimeo') return null;
    const oembed = source.provider === 'youtube'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(source.url)}`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(source.url)}`;
    const status = (await request(oembed, PAGE_HOSTS))?.status;
    if (status === 401 || status === 403) return 'bloqueado';
    return status === 400 || status === 404 ? 'no-existe' : null;
  } catch {
    return null;
  }
}

/** Imagen del video tal como la publica su plataforma, o `null` si no la ofrece. */
export async function fetchVideoCover(source: VideoSource, maxBytes: number): Promise<Buffer | null> {
  switch (source.provider) {
    case 'youtube': {
      const id = new URL(source.url).searchParams.get('v') ?? source.url.split('/').pop();
      // maxresdefault solo existe en videos subidos en alta resolución.
      return await image(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, maxBytes)
        ?? image(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, maxBytes);
    }
    case 'vimeo': {
      const oembed = await get(`https://vimeo.com/api/oembed.json?width=1280&url=${encodeURIComponent(source.url)}`, PAGE_HOSTS);
      return image((await oembed?.json() as { thumbnail_url?: string } | undefined)?.thumbnail_url, maxBytes);
    }
    case 'facebook':
    case 'tiktok':
      return image(await ogImage(source.url), maxBytes);
    default:
      return null;
  }
}
