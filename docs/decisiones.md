# Registro de decisiones

Decisiones vigentes que debe conocer cualquiera que trabaje en el proyecto, persona o agente. Si una petición contradice alguna, se avisa antes de cambiar nada. Una decisión no se borra: si cambia, se marca como **sustituida** y se añade la nueva con su número.

Formato: número · fecha · decisión. **Por qué** y, si existe, **Detalle** con el documento de referencia.

## Arquitectura y stack

**D-001 · 2026-09 · Stack: Astro estático, Bun + Elysia, PostgreSQL y Tailwind CSS v4; sin React, DaisyUI ni otras librerías de UI.**
Por qué: decidido por el responsable del proyecto; no se reabre salvo que él lo pida.

**D-002 · 2026-09 · El diseño del prototipo aprobado por el cliente no cambia sin una nueva aprobación.**
Por qué: ya pasó por la aprobación del cliente. Las propuestas visuales se muestran con capturas en `design/` antes de implementarse (regla en `AGENTS.md`).

**D-003 · 2026-10-22 · Se mantiene el monolito modular (rutas → servicios → funciones PostgreSQL); sin capas formales, microservicios ni Redis.**
Por qué: sirve al alcance actual. Detalle: `docs/auditoria-arquitectura.md`.

**D-004 · 2026-10-22 · Las funciones SQL se dividen por módulo en `backend/database/funciones/`, cargadas en orden por `src/db/migrate.ts`.**
Por qué: un único `fn.sql` de 1.300 líneas mezclaba todos los dominios. Las definiciones resultantes son idénticas.

## Funcionalidades

**D-005 · 2026-10-01 · El chat responde con preguntas frecuentes editables desde el panel, sin IA; la voz usa la Web Speech API del navegador.**

**D-006 · 2026-10-06 · El video de las páginas de Carlos va solo por enlace (Facebook, TikTok, YouTube, Vimeo o MP4 enlazado); no se suben archivos de video.**
Por qué: evita FFmpeg, procesos aparte y almacenamiento de video en el servidor. Detalle: `docs/plan-paginas-carlos.md`.

**D-007 · 2026-10-24 · La portada del video se toma de su plataforma al pegar el enlace y se guarda como una foto subida; nunca se enlaza. La portada manual se mantiene.**
Por qué: enlazarla enviaría la visita a la plataforma antes de pulsar el video, y los enlaces de Facebook y TikTok caducan. Facebook y TikTok solo la entregan a su rastreador, así que puede dejar de funcionar; entonces se sube a mano.

## Diseño y fotos

**D-008 · 2026-10-23 · Las fotos de Biografía se muestran completas dentro de una caja de 440 × 440 px y nunca más grandes que su archivo.**
Por qué: una foto de 429 × 763 se dibujaba a 509 × 905. Sigue el criterio de la6.org/nuestra-historia. El panel recomienda 880 px o más en el lado largo.

**D-009 · 2026-10-23 · Las fotos de Obras se muestran completas y sin ampliar dentro del marco del carrusel, que es cuadrado en celular vertical.**
Por qué: las fotos verticales quedaban diminutas en el marco 4:3. El panel recomienda 1260 × 990 px o más.

**D-010 · 2026-10-23 · El fondo de cintas de Biografía no se muestra en celular (variante `celular:`).**
Por qué: tapaba textos y la línea de tiempo, y es una descarga que no aporta en pantallas pequeñas. Se mantiene en tablet y escritorio.

## Trabajo y configuración

**D-011 · 2026-10-03 · Despliegue con Docker Compose, GitHub Actions, GHCR y `server-produccion/desplegar.sh`; descartados Dokploy, Vercel y Jenkins.**
Detalle: `server-produccion/README.md`.

**D-012 · 2026-10-25 · `AGENTS.md` y `CLAUDE.md` se versionan como dos copias completas e idénticas.**
Por qué: Codex lee `AGENTS.md` y Claude Code `CLAUDE.md`; el responsable prefiere que cada herramienta tenga su archivo completo.

**D-013 · 2026-10-25 · La memoria de los agentes es local de cada equipo (`PROJECT_MEMORY.md`, fuera de Git); el contexto del código, un mapa de Graphify en `graphify-out/` (fuera de Git, salvo los nombres de sus subsistemas).**
Por qué: los agentes de una misma máquina comparten el contexto sin releer el proyecto. Lo que deba saber todo el equipo va a este registro o a `docs/`.

**D-014 · 2026-10-25 · Gestión de configuración ligera: versiones semánticas con tag y Release por versión, `CHANGELOG.md` por versión, plantilla de PR y este registro. Sin issues, tablero ni protección de `main` por ahora.**
Por qué: hay un solo desarrollador y los cambios se planifican con los clientes en otra herramienta. La protección de `main` se reconsiderará si entra más gente. Detalle: `docs/gestion-de-configuracion.md`.
