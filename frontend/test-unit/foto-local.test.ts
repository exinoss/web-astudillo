import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { medidasArchivo } from '../src/lib/comun/foto-local.ts';

const blob = (datos: Buffer) => new Blob([new Uint8Array(datos)]);
const imagen = (width: number, height: number, channels: 3 | 4 = 3) =>
  sharp({ create: { width, height, channels, background: channels === 4 ? '#ff000080' : '#336699' } });

test('lee las medidas de la cabecera de cada formato que se puede subir', async () => {
  const casos: [string, Buffer][] = [
    ['jpeg', await imagen(1203, 801).jpeg().toBuffer()],
    // Metadatos grandes antes del SOF, como los de una cámara con perfil de color y EXIF.
    ['jpeg con EXIF e ICC', await imagen(1203, 801).withMetadata({ icc: 'p3', exif: { IFD0: { Copyright: 'x'.repeat(30000) } } }).jpeg().toBuffer()],
    ['png', await imagen(1203, 801).png().toBuffer()],
    ['webp con pérdida', await imagen(1203, 801).webp().toBuffer()],
    ['webp sin pérdida', await imagen(1203, 801).webp({ lossless: true }).toBuffer()],
    ['webp con transparencia', await imagen(1203, 801, 4).webp().toBuffer()],
    ['avif', await imagen(1203, 801).avif().toBuffer()],
  ];
  for (const [nombre, datos] of casos)
    assert.deepEqual(await medidasArchivo(blob(datos)), { ancho: 1203, alto: 801 }, nombre);
});

test('una foto de 45 MP se mide sin abrirla y un archivo que no es imagen da null', async () => {
  const enorme = await imagen(9000, 5000).jpeg().toBuffer();
  assert.deepEqual(await medidasArchivo(blob(enorme)), { ancho: 9000, alto: 5000 });
  assert.equal(await medidasArchivo(new Blob(['no soy una foto'])), null);
  assert.equal(await medidasArchivo(blob(enorme.subarray(0, 40))), null);
});
