import type { Page } from '@playwright/test';

// Las fotos de prueba no existen como archivo (src/lib/data/mock/fotos.ts): cualquier petición a /medios/ recibe un píxel.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

export const servirFotos = (page: Page) => page.route('**/medios/**', route => route.fulfill({ contentType: 'image/png', body: PIXEL }));
