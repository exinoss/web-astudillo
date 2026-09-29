import { Elysia } from 'elysia';
import { join } from 'node:path';
import { ApiError } from '../../http';

// Solo nombres generados por la subida: impide salir de la carpeta con rutas relativas.
const FILE = /^[a-z0-9-]{8,80}-\d{2,4}\.webp$/;

/** Sirve las fotos subidas durante el desarrollo, cuando no hay nginx delante. */
export function mediaFileRoutes(mediaDir: string) {
  return new Elysia().get('/medios/:archivo', ({ params }) => {
    if (!FILE.test(params.archivo)) throw new ApiError(404, 'No encontrado');
    const file = Bun.file(join(mediaDir, params.archivo));
    return file.exists().then(ok => {
      if (!ok) throw new ApiError(404, 'No encontrado');
      return new Response(file, { headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable' } });
    });
  });
}
