import type { ImageMetadata } from "astro";
import type { Original } from "../../../../backend/src/contracts/inicio";
import portada from "../../assets/portada.jpg";
import piezaRespeto from "../../assets/pieza-respeto-vertical.png";
import piezaFerrocarril from "../../assets/pieza-ferrocarril.jpg";
import piezaTululbi from "../../assets/pieza-tululbi.jpg";

export const ORIGINALES: Record<Original, ImageMetadata> = {
  portada, "pieza-respeto": piezaRespeto, "pieza-ferrocarril": piezaFerrocarril, "pieza-tululbi": piezaTululbi,
};
