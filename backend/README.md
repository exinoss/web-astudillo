# Backend — Carlos Astudillo (pendiente de implementación)

Este directorio contendrá la API en **Bun + Elysia** que respalda el sitio en `frontend/`. Todavía no se implementa: primero se diseñará la base de datos en **PostgreSQL**. Este documento fija el contrato (entidades + endpoints) que el frontend ya espera, para que la implementación futura no requiera tocar el frontend.

El frontend ya está preparado para este contrato: su capa de acceso a datos (`frontend/src/lib/data/`) define interfaces (`ContentRepository`, `SubmissionRepository`) con una implementación *mock* (datos locales, usada hoy) y una implementación *http* (stub ya escrito, apunta a los endpoints de abajo). Cambiar de mock a http es una variable de entorno (`PUBLIC_DATA_SOURCE=http` + `PUBLIC_API_BASE_URL`, ver `frontend/.env.example`), no una reescritura de páginas.

## Entidades

Inferidas de los datos hoy hardcodeados en el prototipo (`frontend/src/lib/data/mock/seed-data.ts` y el contenido de las páginas).

### `Proposal` (propuesta / eje de campaña)

| Campo | Tipo | Notas |
|---|---|---|
| `slug` | string | identificador en la URL (`/propuestas/:slug/`), único |
| `name` | string | ej. "Agua potable" |
| `icon` | string | nombre de ícono (ver `frontend/src/components/Icon.astro` para el set actual) |
| `label` | string | categoría corta, ej. "Servicios básicos" |
| `intro` | string | una línea, se muestra en el banner de detalle |
| `content` | rich text / markdown (**nuevo**) | hoy cada página de propuesta solo muestra "Contenido en preparación" — este campo no existe aún, se añade cuando haya contenido real |
| `order` | number (**nuevo**, opcional) | para controlar el orden de la grilla si deja de ser alfabético/fijo |

Hoy son 7 propuestas fijas (agua-potable, centro-de-alto-rendimiento, mercado-municipal, terminal-terrestre, agronomia, educacion, tecnologias-emergentes).

### `CitizenLink` (espacio de ciudadanía)

| Campo | Tipo | Notas |
|---|---|---|
| `slug` | string | `/ciudadania/:slug/` — hoy son 3 valores fijos: `sugerencias`, `alerta-ciudadana`, `chat` |
| `name` | string | |
| `icon` | string | |
| `description` | string | |

Es poco probable que esto necesite un CRUD completo (son 3 "espacios" fijos del sitio), pero se modela igual como datos para no hardcodear si se agrega un cuarto.

### `CandidateProfile` (perfil del candidato)

No existe todavía como entidad — hoy el nombre, partido, lista, ciudad y eslóganes están repetidos como texto literal en varios archivos (`Layout.astro`, `index.astro`, `acerca-de-nosotros.astro`). Candidato a centralizarse:

| Campo | Tipo | Valor actual (hardcodeado) |
|---|---|---|
| `nombre` | string | "Carlos Astudillo" |
| `partido` | string | "Partido Social Cristiano" |
| `lista` | string | "Lista 6" |
| `ciudad` | string | "San Lorenzo, Esmeraldas" |
| `eslogan` | string | "Por ti, San Lorenzo." |
| `biografia` | rich text (**nuevo**) | hoy: "La biografía completa está pendiente de incorporación." |
| `motivacion` | rich text (**nuevo**) | hoy: "El mensaje completo del candidato se incorporará a esta sección." |

### `ContactChannel` (canal de contacto)

Hoy hardcodeado en `index.astro`: Facebook (`@carlosastudillo7`), TikTok (`@carlosastudillo01`), WhatsApp (`+593 96 136 8214`). Modelar como lista de `{ nombre, tipo, handle, url }` si se espera que cambien con frecuencia; si no, puede quedar como configuración estática en el frontend.

### `Suggestion` (sugerencia ciudadana)

Formulario en `/ciudadania/sugerencias/`. Campos enviados por el frontend (`SuggestionInput` en `frontend/src/lib/data/types.ts`):

| Campo | Tipo | Obligatorio |
|---|---|---|
| `nombre` | string | no |
| `tema` | string (slug de `Proposal`, o `"otro"`) | sí |
| `mensaje` | string (15–1500 caracteres) | sí |
| `createdAt` | timestamp | generado por el backend |

### `CitizenAlert` (alerta ciudadana / reporte de daño)

Formulario en `/ciudadania/alerta-ciudadana/`, incluye una foto opcional (multipart). Campos (`AlertInput`):

| Campo | Tipo | Obligatorio |
|---|---|---|
| `nombre` | string | no |
| `sector` | string (barrio/sector) | sí |
| `referencia` | string (punto de referencia) | no |
| `descripcion` | string (15–1500 caracteres) | sí |
| `foto` | archivo (JPG/PNG/WebP, máx. 10 MB) | no |
| `fotoUrl` | string | generado por el backend al guardar el archivo |
| `createdAt` | timestamp | generado por el backend |
| `estado` | enum (**nuevo**, ej. `pendiente`/`revisado`/`resuelto`) | para uso interno del equipo de campaña, no expuesto en el sitio público hoy |

Necesita almacenamiento de archivos (disco local, S3-compatible, etc.) — decisión pendiente, no bloquea el resto del contrato.

## Endpoints propuestos

Formas idénticas a las interfaces en `frontend/src/lib/data/types.ts`, para que las implementaciones `Http*Repository` (ya escritas en el frontend) funcionen sin cambios.

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/api/proposals` | lista de propuestas (home, dropdown de navegación, `<select>` de sugerencias) |
| `GET` | `/api/proposals/:slug` | detalle de una propuesta |
| `GET` | `/api/citizen-links` | los 3 espacios de ciudadanía |
| `GET` | `/api/candidate-profile` | perfil del candidato (aún sin consumir desde el frontend, pendiente cuando exista contenido real) |
| `GET` | `/api/contact-channels` | canales de contacto (igual, pendiente de decidir si vale la pena o queda estático) |
| `POST` | `/api/suggestions` | crea una `Suggestion`; responde `{ ok: boolean, message: string }` |
| `POST` | `/api/alerts` | crea una `CitizenAlert`, `multipart/form-data` (incluye `foto`); responde `{ ok: boolean, message: string }` |

No hay endpoint de chat: el widget de `/ciudadania/chat/` es una demo de respuestas por palabra clave, resuelta enteramente en el cliente (`frontend/src/lib/data/mock/mock-chat-repository.ts`); no está en el alcance de este contrato a menos que se decida más adelante convertirlo en algo real (FAQ dinámico, IA, etc.).

## Notas de arquitectura sugeridas (no vinculantes, a decidir junto con el diseño de la BD)

- Capas: rutas Elysia → servicios → repositorios (ORM/query builder a elección) → PostgreSQL. Un módulo por dominio (`proposals`, `profile`, `contact`, `suggestions`, `alerts`), aprovechando el sistema de plugins de Elysia.
- Validación de entrada con los esquemas nativos de Elysia (basados en TypeBox), reutilizando las formas de `frontend/src/lib/data/types.ts` como referencia.
- El almacenamiento de fotos de `CitizenAlert` es la única pieza con una decisión de infraestructura pendiente (disco vs. objeto remoto); no bloquea el resto del backend.
