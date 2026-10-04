// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// En desarrollo, la API y las fotos subidas vienen del backend.
const backend = process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000';
const proxy = { '/api': backend, '/medios': backend };

// https://astro.build/config
export default defineConfig({
  site: 'https://lanuevahistoria.tech',
  output: 'static',
  server: { host: true },
  vite: {
    plugins: [tailwindcss()],
    // Las compilaciones del publicador y de las pruebas no se vigilan: en Windows el vigilante
    // bloquea la carpeta y el publicador no podría moverla a `dist`.
    server: { proxy, watch: { ignored: [/[\\/]dist-(nueva|anterior|test)([\\/]|$)/] } },
    preview: { proxy },
  },
});
