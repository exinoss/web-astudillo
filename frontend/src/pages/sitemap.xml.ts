import type { APIRoute } from 'astro';
import { contentRepository } from '../lib/data';
import { absoluteUrl, publicPaths } from '../lib/seo';
export const GET: APIRoute = async () => {
  const [proposals,citizens]=await Promise.all([contentRepository.getProposals(),contentRepository.getCitizenLinks()]);
  const paths=[...publicPaths,...proposals.map(p=>`/propuestas/${p.slug}/`),...citizens.map(p=>`/ciudadania/${p.slug}/`)];
  const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>${escape(absoluteUrl(p))}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
