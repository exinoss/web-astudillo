import type { VideoSource } from '../../contracts/video';

const TIMEOUT_MS = 8000;
const IMAGE_HOSTS = [/^i\.ytimg\.com$/, /^i\.vimeocdn\.com$/, /\.fbcdn\.net$/, /\.tiktokcdn(-us)?\.com$/];
const PAGE_HOSTS = [/(^|\.)facebook\.com$/, /(^|\.)tiktok\.com$/, /^vimeo\.com$/];
// Facebook y TikTok solo publican la imagen del video (og:image) para su propio rastreador.
const CRAWLER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const allowed = (url: string, hosts: RegExp[]) => {
  const { protocol, hostname } = new URL(url);
  return protocol === 'https:' && hosts.some(host => host.test(hostname));
};

async function get(url: string, hosts: RegExp[], headers: Record<string, string> = {}) {
  if (!allowed(url, hosts)) return null;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  // Las redirecciones no pueden sacar la descarga de los dominios permitidos.
  return response.ok && allowed(response.url || url, hosts) ? response : null;
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
