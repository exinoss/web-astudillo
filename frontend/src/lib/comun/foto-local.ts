// El archivo elegido nunca se pinta tal cual: una JPEG de 100 MP puede pesar 4 MB y, en un <img>, ocupa
// unos 400 MB y traba la pestaña cada vez que se vuelve a mostrar.

type Medidas = { ancho: number; alto: number };

// El SOF de una JPEG va después de los metadatos (EXIF, ICC), que pueden ocupar varios cientos de KB.
const CABECERA = 1024 * 1024;

const ascii = (b: Uint8Array, i: number, texto: string) => [...texto].every((c, j) => b[i + j] === c.charCodeAt(0));

function jpeg(b: Uint8Array, v: DataView): Medidas | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marca = b[i + 1];
    if (marca === 0xff) { i++; continue; }
    // SOF0-SOF15 menos DHT (C4), JPG (C8) y DAC (CC).
    if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) return { alto: v.getUint16(i + 5), ancho: v.getUint16(i + 7) };
    i += 2 + v.getUint16(i + 2);
  }
  return null;
}

function webp(b: Uint8Array, v: DataView): Medidas | null {
  if (ascii(b, 12, "VP8X")) return { ancho: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), alto: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  if (ascii(b, 12, "VP8 ")) return { ancho: v.getUint16(26, true) & 0x3fff, alto: v.getUint16(28, true) & 0x3fff };
  if (ascii(b, 12, "VP8L")) {
    const bits = v.getUint32(21, true);
    return { ancho: 1 + (bits & 0x3fff), alto: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
}

/** AVIF guarda las medidas en cajas `ispe` (la imagen y sus miniaturas): vale la mayor. */
function avif(b: Uint8Array, v: DataView): Medidas | null {
  let mayor: Medidas | null = null;
  for (let i = 4; i + 16 <= b.length; i++) {
    if (!ascii(b, i, "ispe")) continue;
    const m = { ancho: v.getUint32(i + 8), alto: v.getUint32(i + 12) };
    if (!mayor || m.ancho * m.alto > mayor.ancho * mayor.alto) mayor = m;
  }
  return mayor;
}

/** Medidas leídas de la cabecera, sin decodificar la imagen; null si el formato no se reconoce. */
export async function medidasArchivo(archivo: Blob): Promise<Medidas | null> {
  const b = new Uint8Array(await archivo.slice(0, CABECERA).arrayBuffer());
  const v = new DataView(b.buffer);
  try {
    if (b[0] === 0xff && b[1] === 0xd8) return jpeg(b, v);
    if (ascii(b, 1, "PNG")) return { ancho: v.getUint32(16), alto: v.getUint32(20) };
    if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return webp(b, v);
    if (ascii(b, 4, "ftyp")) return avif(b, v);
  } catch {
    // Cabecera cortada o dañada: el backend la rechazará al subirla.
  }
  return null;
}

/**
 * URL de una miniatura cuyo lado corto mide `lado` px. `createImageBitmap` decodifica fuera del hilo principal
 * y el original se suelta enseguida; la página solo guarda la miniatura. Quien la pide debe revocar la URL.
 * Null si el navegador no puede abrir la foto: nunca se recurre al original.
 */
export async function miniaturaLocal(archivo: Blob, lado: number): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, lado / Math.min(bitmap.width, bitmap.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(bitmap.width * escala));
    lienzo.height = Math.max(1, Math.round(bitmap.height * escala));
    lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
    if (blob) return URL.createObjectURL(blob);
  } catch {
    // Sin createImageBitmap o con una foto dañada o en un formato que este navegador no abre.
  }
  return null;
}
