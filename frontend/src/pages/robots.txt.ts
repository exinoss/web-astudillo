import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/comun/seo';
export const GET: APIRoute=()=>new Response(`User-agent: *\nAllow: /\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});
