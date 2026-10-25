# Frontend — Carlos Astudillo

Sitio web de campaña de Carlos Astudillo (candidato a la alcaldía de San Lorenzo, Esmeraldas), construido con [Astro](https://astro.build).

Migrado desde el prototipo aprobado (`PrototipoAstudillo`), preservando exactamente el mismo diseño, contenido y comportamiento. Ver el plan de migración en `docs/` (raíz del repo) para el detalle de las fases.

## Comandos

Todos los comandos se ejecutan desde esta carpeta (`frontend/`):

| Comando          | Acción                                              |
| :--------------- | :--------------------------------------------------- |
| `bun install`     | Instala las dependencias                             |
| `bun run dev`     | Inicia el servidor de desarrollo en `localhost:4321` (necesita el backend encendido) |
| `bun run build`   | Genera el sitio estático en `./dist/` con el contenido publicado (necesita el backend) |
| `bun run preview` | Sirve el build localmente                            |
| `bun run check`   | Verifica tipos de TypeScript (`astro check`)         |
| `bun run test`    | Corre Playwright; compila su propia copia con la semilla, sin backend |

## Estructura

- `src/pages/` — rutas del sitio (home, propuestas, ciudadanía, acerca de nosotros).
- `src/layouts/Layout.astro` — plantilla base (header, footer, panel de accesibilidad).
- `src/components/comun/Icon.astro` — íconos SVG inline.
- `src/lib/data/` — repositorios separados: contenido publicado (HTTP, o la semilla del código al compilar en modo de pruebas), autenticación, alertas, sugerencias y chat por HTTP.
- `src/lib/ciudadania/participacion/` — borrador de lo que escribe un votante sin sesión (se recupera tras iniciar sesión), envío con sesión y tipos de alerta.
- `src/pages/cuenta/` — registro, acceso, verificación, recuperación y perfil conectados a la API.
- `src/styles/` — estilos globales con Tailwind CSS v4.
- `tests/` — pruebas end-to-end con Playwright.

El frontend importa con rutas relativas los contratos puros de `backend/src/contracts/` (legal, redes, video, contraseña y nombre de la variante de tarjeta de las fotos) y, en modo de pruebas, la semilla `backend/database/contenido-inicial.json`. Por eso compila solo con la carpeta `backend/` al lado; la imagen del publicador (`server-produccion/Dockerfile.publicador`) copia ambas. Desde el frontend solo se importan módulos sin dependencias de servidor: nada que use `sharp`, `SQL` de Bun, `ApiError` o configuración.

## API y correo

El navegador usa `/api` en el mismo origen; Astro lo envía al backend de `127.0.0.1:3000` en desarrollo y preview. `APP_ORIGIN` del backend debe ser la URL pública de Astro (`http://localhost:4321` en desarrollo). En producción nginx sirve el sitio y `/api` en el mismo dominio ([server-produccion](../server-produccion/README.md)). `API_PROXY_TARGET` solo cambia el destino del proxy local y de la lectura del contenido al compilar.

Para probar Google, configurar `PUBLIC_GOOGLE_CLIENT_ID` con el mismo cliente OAuth web usado en `GOOGLE_CLIENT_ID` del backend y autorizar `http://localhost:4321` en Google Cloud. El ID es público; no publicar secretos ni credenciales SMTP. Los flujos de correo pueden probarse con Mailpit siguiendo `backend/README.md`.

No se gestionan desde el panel, y siguen en el código cruzados por slug: los iconos de la franja de ciudadanía (sus nombres y descripciones sí son textos editables) y los modelos 3D de las propuestas (`public/models/` y `proposalModels` en `src/lib/data/presentation.ts`). Los modelos pendientes y cómo añadirlos están en [plan-modelos-3d.md](../docs/plan-modelos-3d.md).

## Límite de intentos en los formularios

Cuando la API responde 429, `src/lib/cuenta/auth/bloqueo.ts` deja el botón en gris con un candado y una cuenta atrás (`reintentarEn`), y lo reactiva al llegar a cero. Se usa en acceso, registro y recuperación. En el acceso, el primer bloqueo (`sugerirRecuperacion`) ofrece restablecer la contraseña con el correo ya escrito (`/cuenta/recuperar/?correo=…`); el modo enlace lleva a `/cuenta/acceso/`. Con «Reducir movimiento» el candado queda quieto (`styles/bloqueo.css`). Las reglas y la escalada están en [backend/README.md](../backend/README.md#límite-de-intentos).

Para el despliegue, usa el mismo ID de cliente web en `PUBLIC_GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_ID` del backend (en producción ambos salen de `GOOGLE_CLIENT_ID`); autoriza el origen público del frontend en Google Auth Platform. La implementación de cuenta sigue la propuesta visual aprobada en [propuesta-v2.md](../design/propuestas/cuenta/propuesta-v2.md).
