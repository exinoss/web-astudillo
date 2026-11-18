import { conoceMasHeader, alcaldeHeader } from "./cabeceras";
import { closingSection } from "./cierre";
import { interviewSection } from "./entrevista";
import { gallerySection } from "./galeria";
import { cardsSection } from "./tarjetas";
import { videoSection } from "./video";
import type { AboutCarlosPageView } from "./vista";

/** Cuerpo de una página de Carlos; lo usan la página publicada y la vista previa del borrador. */
export function aboutCarlosPageMarkup(view: AboutCarlosPageView) {
  if (view.slug === "por-que-quiero-ser-alcalde") return `${alcaldeHeader(view.texts)}
${cardsSection("alcalde.tarjetas", view.texts, view.cards)}
${view.videos.map(videoSection).join("")}
${closingSection("Conoce las propuestas para San Lorenzo.", "/#propuestas", "Ver propuestas")}`;
  return `${conoceMasHeader(view.texts)}
${interviewSection(view.interview)}
${cardsSection("conoce-mas.tarjetas", view.texts, view.cards)}
${gallerySection(view.gallery)}
${view.videos.map(videoSection).join("")}
${closingSection("Conoce mi recorrido y los momentos que me trajeron hasta aquí.", "/acerca-de-nosotros/biografia/", "Conoce mi trayectoria")}`;
}
