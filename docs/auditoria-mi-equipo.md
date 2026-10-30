# Auditoría de la rama `feat/vista-consejales`

Fecha: 2026-10-30. Alcance: todos los cambios sin commit de la rama, sobre `main` en `797fbb2`. Son 59 archivos modificados y 14 nuevos:

- la página «Mi equipo» y su editor en el panel;
- los textos «Acerca de mí» y «Conoce más sobre mí» y el botón «Conoce a mi equipo» de la portada;
- el visor de fotos y el carrusel, que pasan a ser compartidos;
- los cambios en la subida de fotos: tope de 40 megapíxeles con aviso claro, AVIF, aviso para HEIC y versiones generadas una detrás de otra.

## Veredicto

**Los cambios cumplen la arquitectura y las reglas del proyecto, y funcionan.** La auditoría encontró cuatro defectos menores, ya corregidos y probados (ver «Hallazgos corregidos»). No queda ningún problema abierto. Al final hay tres observaciones que no son defectos, pero conviene conocerlas antes de desplegar.

## Cómo se auditó

- Lectura del diff completo y de cada archivo nuevo, contrastado con `AGENTS.md`/`CLAUDE.md` y `docs/decisiones.md`.
- Pruebas automáticas:
  - backend: `check` y 116 pruebas sobre una base PostgreSQL 17 desechable;
  - frontend: `check`, `test:unit` y 125 pruebas de Playwright;
  - `bun run build` contra un backend temporal.
- Comparación visual píxel a píxel del último commit (`797fbb2`) con la rama, para los componentes que se refactorizaron.
- Mediciones de memoria y tiempo al procesar fotos, y comparación de las fotos generadas antes y después del cambio.
- Comprobaciones en el entorno real: formato de números en la imagen `oven/bun:1.3.14-alpine` de producción, una foto HEIC real y una AVIF real.

## Arquitectura

### Backend: rutas → servicios → funciones SQL

| Pieza | Dónde | Valoración |
|---|---|---|
| Rutas | [content/routes/index.ts](../backend/src/content/routes/index.ts) | Validan forma y tamaño con `t.Object(..., strict)` y delegan en el servicio. Sin lógica. |
| Servicio | [content/services/my-team.ts](../backend/src/content/services/my-team.ts) | Autoriza primero, normaliza con `plainText`, comprueba que las fotos existan y llama a la base solo por `callPg`. |
| SQL | `fn_my_team_list` y `fn_my_team_save` en [contenido.sql](../backend/database/funciones/contenido.sql) | `SECURITY INVOKER` por defecto, sin SQL dinámico. La escritura repite la comprobación de permiso y queda en auditoría. `fn_content_versions` (`LANGUAGE sql`) va después de la función que llama. |
| Esquema | `tb_mi_equipo` en [schema.ts](../backend/src/db/schema.ts) y migración [0013_mi_equipo.sql](../backend/drizzle/0013_mi_equipo.sql) | La migración es la que genera Drizzle (`db:generate`), con nombre descriptivo. La restricción de claves se construye desde la misma lista de parroquias, sin repetirla a mano. |
| Arranque | [migrate.ts](../backend/src/db/migrate.ts) | `assertMigrated` exige la tabla y la función nuevas: el backend no arranca con una base sin migrar. |
| Catálogo | [call.ts](../backend/src/db/call.ts) | `myTeamList` y `myTeamSave` registrados. |

El modelo de datos sigue el de «Acerca de Carlos» (`tb_acerca_de_carlos`): un documento `jsonb` por parte editable. La versión de una parte nunca guardada es nula, igual que los textos. Así no hace falta sembrar doce filas ni duplicar la lista de parroquias en SQL.

### Código compartido: lo global está en carpetas globales

| Pieza | Lo usan | Dónde está |
|---|---|---|
| Lista de parroquias y topes (`PARROQUIAS`, `MAX_EQUIPO`, `MAX_FOTOS_PARROQUIA`) | backend (validación y esquema), sitio y panel | [backend/src/contracts/parroquias.ts](../backend/src/contracts/parroquias.ts), junto a los demás contratos compartidos |
| Formatos de foto y aviso de HEIC | backend, panel y alertas | [backend/src/contracts/media.ts](../backend/src/contracts/media.ts) |
| `photosById` | servicios de «Acerca de Carlos» y de «Mi equipo» | [content/services/media.ts](../backend/src/content/services/media.ts); antes era una función privada de `about-carlos.ts` |
| Visor de fotos a pantalla completa | galería de «Conoce más sobre mí» y parroquias | [frontend/src/lib/comun/visor-fotos.ts](../frontend/src/lib/comun/visor-fotos.ts) |
| Carrusel de fotos | Obras y parroquias | [components/comun/CarruselFotos.astro](../frontend/src/components/comun/CarruselFotos.astro) y [scripts/comun/carrusel-fotos.ts](../frontend/src/scripts/comun/carrusel-fotos.ts) |
| `ImageView`, `imageView()` e `img()` | «Acerca de Carlos» y el visor | [lib/comun/fotos.ts](../frontend/src/lib/comun/fotos.ts) y [lib/comun/html.ts](../frontend/src/lib/comun/html.ts); antes estaban dentro de `acerca-de-carlos/`, y `comun` habría dependido de una sección |
| Botón de subida y botones subir/bajar/quitar del panel | todas las secciones del panel | [scripts/cuenta/panel/ui.ts](../frontend/src/scripts/cuenta/panel/ui.ts); antes estaban en `acerca-de-carlos/comun.ts` |
| Silueta de persona sin foto | página y panel de «Mi equipo» | [lib/mi-equipo/silueta.ts](../frontend/src/lib/mi-equipo/silueta.ts): solo la usa esta sección, así que no va a `comun` |

Lo que es propio de una sección se quedó en ella:
- los componentes `Parroquia.astro` y `Persona.astro`;
- los scripts del panel en `panel/mi-equipo/`;
- el acordeón de Obras, en `evidencias.ts`.

No quedaron copias duplicadas. El visor y el carrusel del prototipo no se trasladaron como copia: se extrajeron de los que ya tenía el sitio.

### Frontend: datos y páginas

- **Datos por repositorio:** la página lee de `contentRepository.getMyTeam()`. `SnapshotRepository` lo implementa una vez para sus tres variantes (HTTP, archivo de vista previa y prueba), sin ningún `fetch` directo.
- **Componentes y estilos:** son `.astro` sin frameworks de cliente, con utilidades de Tailwind y las variantes del proyecto (`max-mobile`, `max-tablet`, `max-laptop`). No hay CSS propio.
- **Fotos subidas:** se muestran con `Foto.astro` y `srcset`. En el carrusel no se amplían más que su archivo (`medidasFoto()`, el mismo criterio que Obras, D-009). Las tarjetas del equipo recortan a propósito, como permite la regla para tarjetas.
- **Textos editables:** el encabezado de la página son tres textos nuevos (`equipo.*`) en la semilla y en el registro de textos. Llegan a producción por la migración, igual que los demás.

## Reglas del proyecto

| Regla | Estado | Evidencia |
|---|---|---|
| Minimalismo, DRY, YAGNI | Cumple | Sin dependencias nuevas. Se descartó `heic-decode` (8,7 MB, LGPL) porque casi ninguna foto HEIC llega al sitio (decisión en `PROJECT_MEMORY.md`). |
| Seguridad: entrada, autenticación, permisos | Cumple | Validación en la ruta y en el servicio. Se autoriza antes de validar, para no dar pistas a quien no tiene permiso. La función SQL repite el permiso. El HTML generado escapa todo dato de la API con `esc()`. |
| Mensajes que no revelan cómo funciona el sistema | Cumple | 401/403/404/409 con los mensajes genéricos de siempre. Los avisos de foto solo dicen límites y qué hacer. |
| Idempotencia y concurrencia | Cumple | Bloqueo `pg_advisory_xact_lock` y comparación de versión en la misma transacción; repetir responde `sin_cambios`. Hay pruebas de repetición y de conflicto (409) para el equipo y para las parroquias. En el panel, `busy` y `vigilarCambios`. |
| Diseño aprobado | Cumple | La página sigue la propuesta B aprobada. Las cuatro diferencias con el prototipo se le comunicaron al usuario. Los refactors de Obras y de la galería dan un resultado **idéntico píxel a píxel**: 8 de 8 capturas comparadas. |
| Responsividad | Cumple | Revisado en 320, 390, 480/481, 760/761, 768, 1100/1101 y 1440 px, sin desplazamiento horizontal, con pruebas automáticas. |
| Accesibilidad | Cumple | Acordeones nativos y carrusel con `role="region"` y nombre. Visor con foco de vuelta, teclado y Escape. «Reducir movimiento» detiene el carrusel. Áreas táctiles de 44 px. |
| Fotos subidas nunca más grandes que su archivo | Cumple | Prueba con fotos de 1600 px y comprobación con una foto pequeña (420 px) y una vertical en el prototipo. |
| Peso | Cumple | Sin librerías nuevas en el cliente. Las imágenes de las parroquias se cargan al abrirse, y las del visor solo al ampliarlas. |
| Contenido de ejemplo (D-017) | Cumple | Sin fotos ni textos provisionales en el proyecto. Las pruebas usan registros sin archivo, en `mock/mi-equipo.ts`. Cada sección tiene su propio aviso cuando falta una foto. |
| Comentarios | Cumple | Cada comentario nuevo explica un porqué, un contrato o una dependencia con otro archivo. Se quitó uno que solo describía. |
| Nombres | Cumple | Los archivos y funciones dicen lo que contienen (`parroquias.ts`, `CarruselFotos.astro`, `photosById`, `formatProblem`). |
| `CHANGELOG.md` | Cumple | Anotados en `[Unreleased]`: lo nuevo (Added), lo cambiado (Changed) y lo corregido (Fixed). |
| Verificación antes de entregar | Cumple | Ver «Cómo se auditó». Lo que depende del navegador (carrusel, visor y galería) se probó también en `astro dev`. |

## Subida de fotos

- **Tope de 40 megapíxeles:** se comprueba leyendo solo la cabecera de la foto, sin abrirla. Ahora responde con un aviso que da las medidas, en lugar de «formato no válido». La imagen de producción formatea bien los decimales («76,2»).
- **Versiones una detrás de otra:**
  - la comparación de 29 archivos generados antes y después da **0 píxeles distintos**;
  - el pico de memoria baja entre un 15 y un 43 % (medido simulando el núcleo único del VPS);
  - se descartó sacar las versiones pequeñas de una ya reducida, porque cambiaba el resultado.
- **AVIF:** se admite y se convierte a WebP como los demás formatos.
- **HEIC:** se distingue por su códec y se rechaza con su propio aviso, también en el navegador del formulario de alertas. Allí se reconoce incluso sin tipo MIME, por la extensión.

## Hallazgos corregidos durante la auditoría

1. **El avance automático se anunciaba al lector de pantalla.** El contador del carrusel tenía `aria-live="polite"`, así que se leía cada 5 segundos. Ahora el avance automático no se anuncia y el que pide la persona sí. Hay una prueba que lo comprueba.
2. **Selector `:has()` en scripts.** En navegadores sin soporte (Firefox anterior a la 121, Safari anterior a la 15.4), `querySelectorAll` lanza un error y el visor de las parroquias no se montaba. Se cambió por comprobaciones equivalentes que funcionan en todos.
3. **`checkVisibility()` en el carrusel.** No existe en Safari anterior a la 17.4, así que el avance automático habría fallado en iPhones con iOS 16 o 17.0–17.3. Se cambió por `getClientRects()`.
4. **Faltaban dos pruebas que pide la regla de idempotencia.** Faltaba el conflicto al guardar el equipo y la repetición al guardar una parroquia. Están añadidas y pasan.

## Observaciones (no son defectos)

1. **La página se publica vacía al desplegar.** El enlace «Mi equipo» y la página forman parte del código, así que aparecen en cuanto se despliega. Hasta que alguien cargue y publique el equipo desde el panel, la página muestra solo el encabezado y las doce parroquias con su aviso. Si se prefiere, se puede cargar el contenido en el panel y publicar justo después del despliegue.
2. **El carrusel avanza solo y no tiene botón de pausa.** Se detiene con el puntero encima, con el foco del teclado dentro, con el visor abierto y con «Reducir movimiento». Es el mismo criterio que el carrusel de la portada. Un botón de pausa visible sería más estricto con WCAG 2.2.2, pero cambiaría el diseño aprobado, así que solo se anota.
3. **Pendiente del cliente:** el antetítulo «CONOCE MÁS SOBRE CARLOS» de la semilla sigue igual. En producción se cambia desde «Textos y redes».
