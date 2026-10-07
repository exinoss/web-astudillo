import { expect, test } from '@playwright/test';
import initial from '../../backend/database/contenido-inicial.json' with { type:'json' };
import { publicPaths, SITE } from '../src/lib/comun/seo';

test('las páginas públicas tienen descripción propia, canonical, imagen y datos estructurados',async ({request})=>{
  const paths=[...publicPaths,...initial.propuestas.map(p=>`/propuestas/${p.slug}/`),...['sugerencias','alerta-ciudadana','chat'].map(p=>`/ciudadania/${p}/`)];
  const descriptions=new Set<string>();
  for(const path of paths){
    const response=await request.get(path);expect(response.ok()).toBe(true);
    const html=await response.text();
    const description=html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    expect(description).toBeTruthy();descriptions.add(description!);
    expect(html).toContain(`<link rel="canonical" href="${SITE}${path}">`);
    expect(html).not.toContain('content="noindex');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    const photo=html.match(/property="og:image" content="([^"]+)"/)?.[1];
    expect(photo).toMatch(/^https:\/\/lanuevahistoria\.tech\/_astro\/.+\.jpg$/);
    const file=await request.get(new URL(photo!).pathname);expect(file.ok()).toBe(true);
    expect(file.headers()['content-type']).toContain('image/jpeg');
    for(const [,json] of html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs))expect(()=>JSON.parse(json)).not.toThrow();
  }
  expect(descriptions.size).toBe(paths.length);
  const sitemap=await (await request.get('/sitemap.xml')).text();
  for(const path of paths)expect(sitemap).toContain(`<loc>${SITE}${path}</loc>`);
  expect(sitemap).not.toContain('/cuenta/');expect(sitemap).not.toContain('404');
  expect(await (await request.get('/robots.txt')).text()).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test('cuenta y 404 llevan noindex y permiten leer esa instrucción',async ({request})=>{
  for(const path of ['/cuenta/','/cuenta/registro/','/cuenta/recuperar/','/cuenta/restablecer/','/cuenta/acceso/','/cuenta/verificar/','/cuenta/panel/','/404.html']){
    const html=await (await request.get(path)).text();
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
  }
  expect(await (await request.get('/robots.txt')).text()).not.toContain('Disallow: /cuenta');
});
