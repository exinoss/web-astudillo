// @ts-check
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary', '.mp4': 'video/mp4',
};
// Lo que nginx nunca sirve desde la vista previa, más las rutas internas del servidor de desarrollo.
const PASS_THROUGH = /^\/(cuenta|api|medios|@|node_modules|src|__)/;

/**
 * Solo en `astro dev`: hace lo mismo que server-produccion/nginx/default.conf con la cookie `vista_previa`,
 * para ver la vista previa en la misma dirección que el sitio, con la sesión y el panel funcionando.
 * @param {string} backend
 * @returns {import('vite').Plugin}
 */
export function localPreview(backend) {
  const root = resolve('dist-vista-previa');
  const find = async (/** @type {string} */ path) => {
    const file = join(root, path);
    if (file !== root && !file.startsWith(root + sep)) return null;
    for (const candidate of [file, join(file, 'index.html')])
      if (await stat(candidate).then(s => s.isFile(), () => false)) return candidate;
    return null;
  };
  return {
    name: 'vista-previa-local',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const cookie = req.headers.cookie ?? '';
        let path;
        try { path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); } catch { return next(); }
        if (!/(?:^|;\s*)vista_previa=/.test(cookie) || PASS_THROUGH.test(path)) return next();
        const allowed = await fetch(`${backend}/api/vista-previa/acceso`, { headers: { cookie } })
          .then(r => r.status === 204, () => false);
        if (!allowed) {
          res.writeHead(303, { location: '/api/vista-previa/salir' });
          return res.end();
        }
        const file = await find(path);
        // Sin archivo y con extensión puede ser algo del propio servidor de desarrollo.
        if (!file && extname(path)) return next();
        const served = file ?? join(root, '404.html');
        res.writeHead(file ? 200 : 404, {
          'content-type': TYPES[/** @type {keyof typeof TYPES} */ (extname(served))] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        });
        res.end(await readFile(served));
      });
    },
  };
}
