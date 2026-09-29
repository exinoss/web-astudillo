import type { Picture, UploadedPicture } from "./data/types";

export const isUploaded = (picture: Picture): picture is UploadedPicture => "nombre" in picture;

/** URL de una variante de una foto subida; las genera el backend al subirla. */
export const uploadedUrl = (picture: UploadedPicture, width: number) => `/medios/${picture.nombre}-${width}.webp`;

/** `srcset` con todas las variantes disponibles de una foto subida. */
export const uploadedSrcset = (picture: UploadedPicture) =>
  picture.anchos.map((w) => `${uploadedUrl(picture, w)} ${w}w`).join(", ");
