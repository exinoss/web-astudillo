export const SITE = 'https://lanuevahistoria.tech';
export const publicPaths = [
  '/', '/acerca-de-nosotros/', '/acerca-de-nosotros/biografia/',
  '/acerca-de-nosotros/por-que-quiero-ser-alcalde/', '/acerca-de-nosotros/conoce-mas/',
  '/ciudadania/obras-en-ejecucion/', '/aviso-legal/', '/politica-de-privacidad/', '/terminos-y-condiciones/',
];
export const absoluteUrl = (path: string) => new URL(path, SITE).href;
export const plainDescription = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 200);
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
