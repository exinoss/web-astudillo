# Gestión de configuración

Cómo se identifican, cambian, registran y publican las versiones del proyecto. Las decisiones vigentes están en [decisiones.md](decisiones.md).

## Elementos de configuración

Una versión del proyecto es el conjunto de:

| Elemento | Dónde |
| --- | --- |
| Código del sitio y del panel | `frontend/` |
| API y publicador | `backend/src/` |
| Esquema y migraciones | `backend/src/db/schema.ts`, `backend/drizzle/` |
| Funciones, permisos y datos iniciales de PostgreSQL | `backend/database/` |
| Contenido inicial | `backend/database/contenido-inicial.json` |
| Imágenes Docker, Compose, nginx y despliegue | `backend/Dockerfile`, `server-produccion/`, `.github/workflows/despliegue.yml` |
| Reglas para agentes | `AGENTS.md` y `CLAUDE.md` (idénticos) |

No forman parte de una versión: los `.env`, las guías privadas de operación, `design/`, `PROJECT_MEMORY.md` y lo generado (`dist*`, `graphify-out/`, `node_modules`).

## Versiones

Una sola versión para todo el proyecto, porque frontend y backend se despliegan juntos. Sigue [Versionado Semántico](https://semver.org/lang/es/) (`MAYOR.MENOR.PARCHE`):

- **MAYOR:** un cambio que exige pasos manuales al desplegar o rompe algo existente (variables de entorno nuevas obligatorias, una migración que no se puede aplicar sola, una ruta de la API que cambia de contrato).
- **MENOR:** funcionalidad nueva compatible (una sección, una opción del panel, una ruta nueva).
- **PARCHE:** correcciones y cambios internos sin efecto visible para quien usa el sitio.

La versión vive en tres sitios que deben coincidir: `version` de `frontend/package.json`, `version` de `backend/package.json` y el título de la sección en `CHANGELOG.md`.

## Cambios

- **Ramas:** una por cambio (`feat/…`, `fix/…`, `refactor/…`, `docs/…`), fusionada en `main` mediante PR. El PR sigue la plantilla de `.github/pull_request_template.md`.
- **Commits:** estilo [Conventional Commits](https://www.conventionalcommits.org/es/), con la descripción en español: `feat(frontend): …`, `fix(backend): …`, `refactor: …`, `docs: …`, `chore: …`, `ci: …`.
- **CHANGELOG:** cada cambio visible se anota en `## [Unreleased]` (Added, Changed, Fixed, Removed), en lenguaje de quien usa el sitio.
- **Decisiones:** una decisión que deba conocer todo el equipo se añade a [decisiones.md](decisiones.md) en el mismo PR.
- **Pendientes:** se planifican con los clientes en su herramienta. Los de lanzamiento y operación están en [plan-previo-publicacion.md](plan-previo-publicacion.md).

## Publicar una versión

`main` se despliega en producción con cada push (CI, imágenes, respaldo de la base, migración y arranque). Una versión deja constancia de qué se desplegó:

1. En la rama del cambio, pasa `## [Unreleased]` del `CHANGELOG.md` a `## [X.Y.Z] - AAAA-MM-DD`, deja un `## [Unreleased]` vacío encima y actualiza la `version` de los dos `package.json`.
2. Fusiona el PR en `main` y espera a que el despliegue de Actions termine en verde.
3. Crea el tag y la Release sobre ese commit de `main`, con la sección del CHANGELOG como notas:

   ```bash
   git checkout main && git pull
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <archivo con la sección del CHANGELOG>
   ```

## Volver a una versión anterior

El workflow de despliegue acepta un commit ya desplegado (`workflow_dispatch` con `version` = SHA completo). Para volver a una versión, se usa el SHA de su tag (`git rev-list -n 1 vX.Y.Z`). Volver a una imagen anterior **no deshace** una migración ya aplicada; el despliegue respalda la base antes de cada versión.
