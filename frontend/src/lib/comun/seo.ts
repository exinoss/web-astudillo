export const SITE = 'https://lanuevahistoria.tech';
export const publicPaths = [
  '/', '/acerca-de-nosotros/', '/acerca-de-nosotros/biografia/',
  '/acerca-de-nosotros/por-que-quiero-ser-alcalde/', '/acerca-de-nosotros/conoce-mas/', '/mi-equipo/',
  '/ciudadania/obras-en-ejecucion/', '/aviso-legal/', '/politica-de-privacidad/', '/terminos-y-condiciones/',
];
/** Dirección absoluta de una ruta del sitio. */
export const absoluteUrl = (path: string) => new URL(path, SITE).href;
/** Descripción en una sola línea y de hasta 200 caracteres. */
export const plainDescription = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 200);
/** JSON-LD que no puede cerrar la etiqueta `<script>`. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
