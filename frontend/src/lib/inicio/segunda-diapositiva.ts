/** Atributos del botón de la segunda diapositiva: sin enlace se ve apagado y los enlaces externos abren otra pestaña. */
export const atributosBoton = (enlace: string): Record<string, string> =>
  !enlace ? { "aria-disabled": "true" } : enlace.startsWith("/") ? { href: enlace } : { href: enlace, target: "_blank", rel: "noopener noreferrer" };

const MARCO_RETRATO = "h-full w-[47%] max-tablet:w-[49%]";
export const RETRATO = {
  original: `${MARCO_RETRATO} object-cover object-center`,
  subido: `${MARCO_RETRATO} object-contain object-center max-h-[calc(var(--ancho-foto)/var(--proporcion))] max-w-(--ancho-foto)`,
};
