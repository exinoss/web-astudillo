import type { APIRoute } from "astro";
import { correoHtml, IMAGENES, MENSAJES } from "../../../../backend/src/mail/plantilla";

const ARCHIVOS = import.meta.glob<string>("../../../../backend/assets/correo/*", { eager: true, query: "?url", import: "default" });

/** URL publicada de una imagen del correo, por su nombre de archivo. */
const imagen = (clave: keyof typeof IMAGENES) => ARCHIVOS[`../../../../backend/assets/correo/${IMAGENES[clave].archivo}`]!;

/** Correo de confirmación tal como llega, para mostrarlo en el paso 13 de la guía animada. */
export const GET: APIRoute = () => {
  const html = correoHtml(MENSAJES.verificar("#"), { logo: imagen("logo"), cabecera: imagen("cabecera"), hashtag: imagen("hashtag") });
  return new Response(html.replace("<head>", '<head><meta name="robots" content="noindex">'), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};
