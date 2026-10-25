import { cardVariantFile } from "../../../../backend/src/contracts/media";
import type { Picture, UploadedPicture } from "../data/types";

export const isUploaded = (picture: Picture): picture is UploadedPicture => "nombre" in picture;

export const uploadedUrl = (picture: UploadedPicture, width: number) => `/medios/${picture.nombre}-${width}.webp`;

export const uploadedSrcset = (picture: UploadedPicture) =>
  picture.anchos.map((w) => `${uploadedUrl(picture, w)} ${w}w`).join(", ");

/** Con `srcset` el navegador toma como tamaño propio el de `sizes`: el tope real va en estas variables. */
export const medidasFoto = (picture: Picture) => {
  const [ancho, alto] = isUploaded(picture) ? [picture.ancho, picture.alto] : [picture.width, picture.height];
  return `--ancho-foto: ${ancho}px; --proporcion: ${ancho / alto}`;
};

export const cardImageUrl =(picture: UploadedPicture) => `/medios/${cardVariantFile(picture.nombre)}`;
