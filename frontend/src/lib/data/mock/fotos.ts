import type { UploadedPicture } from '../types';

// Registros como los de una foto subida, sin archivo: las pruebas sirven la imagen (tests/support/fotos.ts).
export const fotoDePrueba = (n: number): UploadedPicture => ({ nombre: `prueba-${n}`, ancho: 1600, alto: 1200, anchos: [480, 960, 1600] });
