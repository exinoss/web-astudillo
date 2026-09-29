// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// En desarrollo, la API y las fotos subidas vienen del backend.
const backend = process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000';
const proxy = { '/api': backend, '/medios': backend };

// https://astro.build/config
export default defineConfig({
  output: 'static',
  // El publicador compila cada versión en su propia carpeta (ver backend/src/publisher/worker.ts).
  ...(process.env.ASTRO_OUT_DIR ? { outDir: process.env.ASTRO_OUT_DIR } : {}),
  server: { host: true },
  vite: {
    plugins: [tailwindcss()],
    server: { proxy },
    preview: { proxy },
  },
});
