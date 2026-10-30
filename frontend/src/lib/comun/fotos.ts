import { cardVariantFile } from "../../../../backend/src/contracts/media";
import type { UploadedPicture } from "../data/types";

export const uploadedUrl = (picture: UploadedPicture, width: number) => `/medios/${picture.nombre}-${width}.webp`;

export const uploadedSrcset = (picture: UploadedPicture) =>
  picture.anchos.map((w) => `${uploadedUrl(picture, w)} ${w}w`).join(", ");

/** Con `srcset` el navegador toma como tamaño propio el de `sizes`: el tope real va en estas variables. */
export const medidasFoto = (picture: UploadedPicture) =>
  `--ancho-foto: ${picture.ancho}px; --proporcion: ${picture.ancho / picture.alto}`;

export const cardImageUrl =(picture: UploadedPicture) => `/medios/${cardVariantFile(picture.nombre)}`;

export interface ImageView { src: string; srcset?: string; width?: number; height?: number }

export const imageView = (picture: UploadedPicture): ImageView => ({
  src: uploadedUrl(picture, picture.anchos.at(-1)!), srcset: uploadedSrcset(picture), width: picture.ancho, height: picture.alto,
});
