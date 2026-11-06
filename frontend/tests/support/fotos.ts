// Las fotos de prueba no existen como archivo (src/lib/data/mock/fotos.ts): cualquier petición a /medios/ recibe esta imagen (`prueba.ts`).
// Mide 8 × 8 px: con `srcset`, el navegador divide el ancho por la densidad y un píxel daba naturalWidth 0.
export const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWPQazuIFTEMLQkASyRdQR0FhcgAAAAASUVORK5CYII=', 'base64');
