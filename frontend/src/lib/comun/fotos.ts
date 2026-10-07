import type { Picture, UploadedPicture } from "../data/types";

export const isUploaded = (picture: Picture): picture is UploadedPicture => "nombre" in picture;

export const uploadedUrl = (picture: UploadedPicture, width: number) => `/medios/${picture.nombre}-${width}.webp`;

export const uploadedSrcset = (picture: UploadedPicture) =>
  picture.anchos.map((w) => `${uploadedUrl(picture, w)} ${w}w`).join(", ");

/** El nombre lo fija `cardVariantFile` en backend/src/content/services/media.ts. */
export const cardImageUrl = (picture: UploadedPicture) => `/medios/${picture.nombre}-tarjeta-760.webp`;
