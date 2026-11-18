import principioPrimeroLaGente from "../../../assets/principios-y-valores/principio-primero-la-gente.png";
import principioEstadoJusto from "../../../assets/principios-y-valores/principio-estado-justo.png";
import principioJusticiaSocial from "../../../assets/principios-y-valores/principio-justicia-social.png";
import principioVerdadYCoherencia from "../../../assets/principios-y-valores/principio-verdad-y-coherencia.png";
import principioLibertad from "../../../assets/principios-y-valores/principio-libertad-con-responsabilidad.png";
import principioEquilibrioDePoderes from "../../../assets/principios-y-valores/principio-equilibrio-de-poderes.png";
import valorPalabraYCoherencia from "../../../assets/principios-y-valores/valor-palabra-y-coherencia.png";
import valorLealtad from "../../../assets/principios-y-valores/valor-lealtad.png";
import valorSolidaridad from "../../../assets/principios-y-valores/valor-solidaridad-con-eficacia.png";
import valorResponsabilidad from "../../../assets/principios-y-valores/valor-responsabilidad.png";
import valorVerdadYTransparencia from "../../../assets/principios-y-valores/valor-verdad-y-transparencia.png";
import valorRespeto from "../../../assets/principios-y-valores/valor-respeto.png";
import type { AboutCarlosSlug } from "../../data/types";

export const TARJETAS: Record<AboutCarlosSlug, { imagen: ImageMetadata; texto: string }[]> = {
  "por-que-quiero-ser-alcalde": [
    { imagen: principioPrimeroLaGente, texto: "Primero la gente y especialmente los pobres" },
    { imagen: principioEstadoJusto, texto: "Estado justo y eficiente" },
    { imagen: principioJusticiaSocial, texto: "Justicia social" },
    { imagen: principioVerdadYCoherencia, texto: "Compromiso con la verdad y la coherencia" },
    { imagen: principioLibertad, texto: "Libertad con responsabilidad" },
    { imagen: principioEquilibrioDePoderes, texto: "Democracia con equilibrio de poderes" },
  ],
  "conoce-mas": [
    { imagen: valorPalabraYCoherencia, texto: "Palabra y coherencia" },
    { imagen: valorLealtad, texto: "Lealtad" },
    { imagen: valorSolidaridad, texto: "Solidaridad con eficacia" },
    { imagen: valorResponsabilidad, texto: "Responsabilidad" },
    { imagen: valorVerdadYTransparencia, texto: "Verdad, honestidad y transparencia" },
    { imagen: valorRespeto, texto: "Respeto" },
  ],
};
