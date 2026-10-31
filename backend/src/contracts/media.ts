/** Cambiarlo obliga a cambiar el nombre del archivo: /medios se guarda en caché un año. */
export const CARD_SIZE = 760;
export const cardVariantFile = (name: string) => `${name}-tarjeta-${CARD_SIZE}.webp`;

// Formatos que se pueden subir: el panel y las alertas los ofrecen y el backend los comprueba por su contenido.
export const ACEPTA_FOTOS = 'image/jpeg,image/png,image/webp,image/avif';
export const FORMATOS_FOTO = 'JPG, PNG, WebP o AVIF';
// Tope de píxeles por debajo del de sharp: una imagen «bomba» pequeña en bytes no agota la memoria del servidor
// ni la del navegador que la muestra (una JPEG de 100 MP puede pesar 4 MB).
export const MAX_PIXELES = 40_000_000;
export const avisoMegapixeles = (pixeles: number) =>
  `La foto mide ${(pixeles / 1e6).toLocaleString('es', { maximumFractionDigits: 1 })} megapíxeles; `
  + `el máximo es ${MAX_PIXELES / 1e6} (por ejemplo, 8000 × 5000 px). Redúcela y vuelve a subirla.`;
export const AVISO_HEIC = 'Las fotos HEIC no se pueden subir: súbela desde el mismo iPhone o envíatela por WhatsApp y prueba de nuevo.';
