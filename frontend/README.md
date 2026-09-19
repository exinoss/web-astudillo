# Frontend — Carlos Astudillo

Sitio web de campaña de Carlos Astudillo (candidato a la alcaldía de San Lorenzo, Esmeraldas), construido con [Astro](https://astro.build).

Migrado desde el prototipo aprobado (`PrototipoAstudillo`), preservando exactamente el mismo diseño, contenido y comportamiento. Ver el plan de migración en `docs/` (raíz del repo) para el detalle de las fases.

## Comandos

Todos los comandos se ejecutan desde esta carpeta (`frontend/`):

| Comando          | Acción                                              |
| :--------------- | :--------------------------------------------------- |
| `bun install`     | Instala las dependencias                             |
| `bun run dev`     | Inicia el servidor de desarrollo en `localhost:4321` |
| `bun run build`   | Genera el sitio estático en `./dist/`                |
| `bun run preview` | Sirve el build localmente                            |
| `bun run check`   | Verifica tipos de TypeScript (`astro check`)         |
| `bun run test`    | Corre la suite de pruebas Playwright                 |

## Estructura

- `src/pages/` — rutas del sitio (home, propuestas, ciudadanía, acerca de nosotros).
- `src/layouts/Layout.astro` — plantilla base (header, footer, panel de accesibilidad).
- `src/components/Icon.astro` — íconos SVG inline.
- `src/lib/data/` — capa de acceso a datos (hoy con datos locales; preparada para conectarse a la API del backend).
- `src/styles/` — estilos globales (Tailwind + DaisyUI).
- `tests/` — pruebas end-to-end con Playwright.
