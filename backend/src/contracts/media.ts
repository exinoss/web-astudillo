/** Cambiarlo obliga a cambiar el nombre del archivo: /medios se guarda en caché un año. */
export const CARD_SIZE = 760;
export const cardVariantFile = (name: string) => `${name}-tarjeta-${CARD_SIZE}.webp`;

// Formatos que se pueden subir: el panel y las alertas los ofrecen y el backend los comprueba por su contenido.
export const ACEPTA_FOTOS = 'image/jpeg,image/png,image/webp,image/avif';
export const FORMATOS_FOTO = 'JPG, PNG, WebP o AVIF';
export const AVISO_HEIC = 'Las fotos HEIC no se pueden subir: súbela desde el mismo iPhone o envíatela por WhatsApp y prueba de nuevo.';
