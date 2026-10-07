import type { Draft } from "../../../../lib/data/http/admin-api";

export interface PaginaDelSitio { nombre: string; ruta: string }

/** Páginas a las que puede llevar una respuesta, por sección. Las propuestas y los nombres editables salen del borrador. */
export function paginasDelSitio(draft: Draft): { seccion: string; paginas: PaginaDelSitio[] }[] {
  const texto = (clave: string) => draft.textos[clave] || draft.originales[clave];
  return [
    { seccion: "Portada", paginas: [
      { nombre: "Inicio", ruta: "/" },
      { nombre: "Propuestas (en la portada)", ruta: "/#propuestas" },
      { nombre: "Contacto y redes", ruta: "/#contacto" },
    ] },
    { seccion: "Propuestas", paginas: draft.propuestas.map((p) => ({ nombre: p.nombre, ruta: `/propuestas/${p.slug}/` })) },
    { seccion: "Ciudadanía", paginas: [
      ...["alerta-ciudadana", "sugerencias", "chat"].map((slug) => ({ nombre: texto(`ciudadania.${slug}.nombre`), ruta: `/ciudadania/${slug}/` })),
      { nombre: texto("obras.titulo"), ruta: "/ciudadania/obras-en-ejecucion/" },
    ] },
    { seccion: "Acerca de nosotros", paginas: [
      { nombre: "Acerca de nosotros", ruta: "/acerca-de-nosotros/" },
      { nombre: "Biografía", ruta: "/acerca-de-nosotros/biografia/" },
      { nombre: "Por qué quiero ser alcalde", ruta: "/acerca-de-nosotros/por-que-quiero-ser-alcalde/" },
      { nombre: "Conoce más sobre Carlos", ruta: "/acerca-de-nosotros/conoce-mas/" },
    ] },
    { seccion: "Información legal", paginas: [
      { nombre: "Política de privacidad", ruta: "/politica-de-privacidad/" },
      { nombre: "Términos y condiciones", ruta: "/terminos-y-condiciones/" },
      { nombre: "Aviso legal", ruta: "/aviso-legal/" },
    ] },
  ];
}
