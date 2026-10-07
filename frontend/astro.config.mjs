// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { localPreview } from './vista-previa-local.mjs';

// En desarrollo, la API y las fotos subidas vienen del backend.
const backend = process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000';
const proxy = { '/api': backend, '/medios': backend };

// https://astro.build/config
export default defineConfig({
  site: 'https://lanuevahistoria.tech',
  output: 'static',
  // La vista previa (src/lib/data/index.ts) lleva sus archivos aparte: el panel se sirve siempre del sitio
  // publicado y sus scripts no deben cambiar aunque haya una vista previa activa (server-produccion/nginx).
  build: { assets: process.env.CONTENIDO_ARCHIVO ? '_astro-vista-previa' : '_astro' },
  server: { host: true },
  vite: {
    plugins: [tailwindcss(), localPreview(backend)],
    // Las compilaciones del publicador y de las pruebas (`dist-*`) no se vigilan: en Windows el vigilante
    // bloquea la carpeta y el publicador no podría moverla a su sitio.
    server: { proxy, watch: { ignored: [/[\\/]dist-[\w-]+([\\/]|$)/] } },
    preview: { proxy },
  },
});
