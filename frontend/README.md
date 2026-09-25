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
- `src/lib/data/` — repositorios separados: autenticación por HTTP y contenido, sugerencias, alertas y chat locales hasta que existan sus contratos de backend.
- `src/pages/cuenta/` — registro, acceso, verificación, recuperación y perfil conectados a la API.
- `src/styles/` — estilos globales con Tailwind CSS v4.
- `tests/` — pruebas end-to-end con Playwright.

## API y correo

El navegador usa `/api` en el mismo origen; Astro lo envía al backend de `127.0.0.1:3000` en desarrollo y preview. `APP_ORIGIN` del backend debe ser la URL pública de Astro (`http://localhost:4321` en desarrollo). En Vercel, `vercel.json` reenvía `/api` al Nginx del backend. Configura **Root Directory: `frontend`** en el proyecto Vercel. `API_PROXY_TARGET` solo cambia el destino del proxy local.

Para probar Google, configurar `PUBLIC_GOOGLE_CLIENT_ID` con el mismo cliente OAuth web usado en `GOOGLE_CLIENT_ID` del backend y autorizar `http://localhost:4321` en Google Cloud. El ID es público; no publicar secretos ni credenciales SMTP. Los flujos de correo pueden probarse con Mailpit siguiendo `backend/README.md`.

Las funciones locales que aún no guardan datos están inventariadas en [integraciones-pendientes.md](../docs/integraciones-pendientes.md).

Para el despliegue, usa el mismo ID de cliente web en `PUBLIC_GOOGLE_CLIENT_ID` de Vercel y `GOOGLE_CLIENT_ID` del backend; autoriza el origen público del frontend en Google Auth Platform. La implementación de cuenta sigue la propuesta visual aprobada en [propuesta-v2.md](../design/propuestas/cuenta/propuesta-v2.md).
