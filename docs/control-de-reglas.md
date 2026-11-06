# Control de las reglas en local

Las reglas de `CLAUDE.md` y `AGENTS.md` que se pueden comprobar de forma mecánica las revisa un script, no el criterio de quien programa. Todo corre en local; la integración continua no cambia.

## Qué revisa (`herramientas/reglas/`)

| Regla | Qué detecta |
| --- | --- |
| `color-a-mano` | Colores escritos a mano (`#1e7a3c`, `bg-[#06317618]`) en `frontend/src`, en lugar de tokens de `@theme` |
| `breakpoint-a-mano` | `@min-[…]:`, `max-[…]:`, `md:`, `@media` en `.ts`/`.astro`, en lugar de las variantes de `global.css` |
| `clases-repetidas` | El mismo conjunto de 4 o más clases en tres archivos o más |
| `comentario-de-funcion` | Funciones de TypeScript (nivel superior) y SQL sin una sola línea de comentario encima |
| `fetch-fuera-de-datos` | `fetch(` en `frontend/src` fuera de `src/lib/data/` |
| `imagen-sin-assets` | Imágenes locales enlazadas con una ruta escrita a mano |
| `dependencia-nueva` | Dependencias que no estaban en el `package.json` del último commit |

Lo que exige criterio (si un texto revela la seguridad, si el resultado se ve idéntico, si se reutilizó lo que ya existía) no lo ve el script: sigue en manos de las capturas y de la revisión del usuario.

## Cuándo corre

| Momento | Qué | Tiempo aproximado |
| --- | --- | --- |
| Un agente edita un archivo (hook `PostToolUse`) | Reglas sobre ese archivo; el fallo le llega al agente al instante | 0,4 s |
| Un agente termina un turno (hook `Stop`) | Solo los archivos cambiados desde la última verificación: reglas y `check` del paquete tocado | 0,4 s sin cambios; hasta ~15 s |
| `git commit` (hook `pre-commit` en `.githooks/`) | Reglas sobre lo preparado | 1 s |
| `git push` (hook `pre-push` en `.githooks/`) | Las pruebas de Playwright de lo nuevo (`herramientas/reglas/pruebas.ts`): en una rama nueva, respecto a `main`; en una ya subida, desde su último push | ~20–25 s por zona tocada (50 s con cuatro); 0,2 s sin cambios nuevos |
| Integración continua | Las 148 pruebas, en cada PR y en `main` | sin cambios |
| A mano | `bun run reglas` en `frontend/` o `backend/` | 0,5 s |

Lo compartido (`styles/`, `lib/comun/`, `components/comun/`, `layouts/`, `tests/support/`) no tiene pruebas propias en `pruebas.ts`: pasarlas todas en local tardaría ~3 minutos, así que lo cubre la integración continua.

Los hooks de los agentes están en `herramientas/reglas/agentes/` y los usan Claude Code (`.claude/settings.json`) y Codex (`.codex/hooks.json`, con `commandWindows` que lanza PowerShell). Las dos configuraciones no se versionan (D-016): cada equipo las crea según `AGENTS.md`/`CLAUDE.md`, y en Codex además se aprueban una vez en `/hooks`; si un hook cambia, Codex lo salta hasta que se vuelva a aprobar.

El hook `Stop` no repite la verificación si los archivos no cambiaron desde la última que pasó, la hiciera Claude Code o Codex. Si falla, el agente debe corregirlo; tras tres intentos fallidos deja terminar con un aviso visible para el usuario.

`bun install` activa el `pre-commit` y el `pre-push` (`git config core.hooksPath .githooks`, en el script `prepare`). El `pre-push` prueba los archivos tal como están en disco: si hay cambios sin commit, avisa. Sin ellos, recuerda qué pruebas pasaron con ese mismo código (por su árbol de Git) y no las repite, por ejemplo al reintentar un push que falló por la red. Usar más procesos en paralelo no lo acelera: con 8 el equipo se satura, tarda más y hay pruebas que fallan al azar.

## Excepciones

`herramientas/reglas/excepciones.json` lista las faltas permitidas, identificadas por regla, archivo y texto (no por número de línea).

- Las que tienen el motivo «Existente al congelar la lista» son el código que ya incumplía las reglas el 2026-11-06: no bloquean, pero no se puede añadir nada nuevo. Es el inventario de lo que queda por corregir; al corregir una, se borra su entrada.
- Una excepción nueva la añade solo el usuario, con su motivo.

## Quién puede cambiar los controles

El hook `PreToolUse` (`herramientas/reglas/agentes/proteger.ts`) protege `.claude/`, `.codex/`, `.githooks/`, `.git/` y `herramientas/reglas/`, y los comandos con `--no-verify`, `core.hooksPath` o `--congelar`. En Codex revisa también las rutas de cada `apply_patch`.

- Claude Code, en modo normal, «aceptar ediciones» o «planificar»: muestra un aviso de permiso y solo el usuario puede aprobarlo, una edición cada vez.
- Claude Code en los modos sin avisos (automático, saltar permisos): se deniega; el usuario cambia al modo normal (Shift+Tab) para autorizarlo.
- Codex: siempre se deniega, porque aún no admite el aviso que pregunta. El usuario hace el cambio él mismo o desactiva el hook un momento en `/hooks`.
- La protección también detiene los comandos que solo mencionan esas rutas en un texto; para editar un archivo que las nombra, el agente usa su herramienta de edición.

## Límites

- El usuario puede saltar el `pre-commit` y el `pre-push` con `--no-verify`.
- Según su documentación, los hooks de Codex son «una barrera útil, no un límite completo»: algunas herramientas internas no pasan por ellos. Lo que se les escape lo frena el `pre-commit`.
- La protección de comandos se basa en el texto del comando: cubre el uso normal, no un comando escrito para disimular la ruta.
- Las pruebas del backend necesitan su base de datos y no corren en local; siguen en la integración continua.
