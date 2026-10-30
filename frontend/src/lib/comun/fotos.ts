import { cardVariantFile } from "../../../../backend/src/contracts/media";
import type { UploadedPicture } from "../data/types";

export const uploadedUrl = (picture: UploadedPicture, width: number) => `/medios/${picture.nombre}-${width}.webp`;

export const uploadedSrcset = (picture: UploadedPicture) =>
  picture.anchos.map((w) => `${uploadedUrl(picture, w)} ${w}w`).join(", ");

/** Con `srcset` el navegador toma como tamaño propio el de `sizes`: el tope real va en estas variables. */
export const medidasFoto = (picture: UploadedPicture) =>
  `--ancho-foto: ${picture.ancho}px; --proporcion: ${picture.ancho / picture.alto}`;

export const cardImageUrl =(picture: UploadedPicture) => `/medios/${cardVariantFile(picture.nombre)}`;
