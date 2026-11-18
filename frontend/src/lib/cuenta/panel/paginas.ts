import type { Draft } from "../../data/http/admin-api";
import { esc } from "../../comun/html";
import { PAGINAS_CARLOS, SLUGS_CARLOS } from "../../../../../backend/src/contracts/acerca-de-carlos";

interface PaginaDelSitio { nombre: string; ruta: string }
type Borrador = Pick<Draft, "textos" | "originales" | "propuestas">;

/** Páginas a las que puede llevar un enlace del panel, por sección. Las propuestas y los nombres editables salen del borrador. */
export function paginasDelSitio(draft: Borrador): { seccion: string; paginas: PaginaDelSitio[] }[] {
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
    { seccion: "Acerca de mí", paginas: [
      { nombre: "Acerca de mí", ruta: "/acerca-de-nosotros/" },
      { nombre: "Biografía", ruta: "/acerca-de-nosotros/biografia/" },
      ...SLUGS_CARLOS.map((slug) => ({ nombre: PAGINAS_CARLOS[slug], ruta: `/acerca-de-nosotros/${slug}/` })),
      { nombre: "Mi equipo", ruta: "/mi-equipo/" },
    ] },
    { seccion: "Información legal", paginas: [
      { nombre: "Política de privacidad", ruta: "/politica-de-privacidad/" },
      { nombre: "Términos y condiciones", ruta: "/terminos-y-condiciones/" },
      { nombre: "Aviso legal", ruta: "/aviso-legal/" },
    ] },
  ];
}

/** Opciones de un selector de páginas; una ruta guardada que ya no está en la lista se conserva como «Otra página». */
export function opcionesDePagina(draft: Borrador, actual: string | null) {
  const secciones = paginasDelSitio(draft);
  const conocida = !actual || secciones.some((s) => s.paginas.some((p) => p.ruta === actual));
  return `<option value="">Sin enlace</option>
    ${conocida ? "" : `<option value="${esc(actual)}" selected>Otra página: ${esc(actual)}</option>`}
    ${secciones.map((s) => `<optgroup label="${esc(s.seccion)}">${s.paginas.map((p) =>
      `<option value="${esc(p.ruta)}" ${p.ruta === actual ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</optgroup>`).join("")}`;
}
