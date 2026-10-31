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

**D-020 · 2026-10-31 · Cambiar el rol de una cuenta, desactivarla o reactivarla exige confirmar la identidad en cada cambio: la contraseña de quien lo hace o, si su cuenta no tiene contraseña (solo Google), un código de 6 dígitos enviado a su correo.**
Por qué: quien encuentre la sesión de un admin abierta en un equipo no debe poder nombrar admins ni bajar o desactivar cuentas. Lo comprueba el backend antes de tocar la base (`auth/services/confirmation.ts`). Los fallos comparten el contador del cambio de contraseña, con esperas crecientes. El código vale 10 minutos y para varios cambios dentro de ese tiempo; pedir otro anula el anterior, y pedirlo dos veces en menos de un minuto no manda otro correo. Se guarda con una sal propia en `tb_token_autenticacion` (propósito `confirmar_accion`, migración 0015).

## Diseño y fotos

**D-008 · 2026-10-23 · Las fotos de Biografía se muestran completas dentro de una caja de 440 × 440 px y nunca más grandes que su archivo.**
Por qué: una foto de 429 × 763 se dibujaba a 509 × 905. Sigue el criterio de la6.org/nuestra-historia. El panel recomienda 880 px o más en el lado largo.

**D-009 · 2026-10-23 · Las fotos de Obras se muestran completas y sin ampliar dentro del marco del carrusel, que es cuadrado en celular vertical.**
Por qué: las fotos verticales quedaban diminutas en el marco 4:3. El panel recomienda 1260 × 990 px o más.

**D-010 · 2026-10-23 · El fondo de cintas de Biografía no se muestra en celular (variante `celular:`).**
Por qué: tapaba textos y la línea de tiempo, y es una descarga que no aporta en pantallas pequeñas. Se mantiene en tablet y escritorio.

**D-018 · 2026-10-30 · Las imágenes de los carruseles de la portada se cambian desde el modo edición. Las que vienen con el sitio entran por la semilla con su clave (`{ "original": "portada" }`) y siguen en `frontend/src/assets`. Un carrusel que se queda sin fotos vuelve a las de la semilla.**
Por qué: la portada debía verse idéntica hasta que alguien la cambie, sin subir las imágenes del cliente a mano en producción, y la semilla es el camino del contenido inicial. Detalle: [cómo funciona la publicación](como-funciona-la-publicacion.md), §3.2, y `backend/src/contracts/inicio.ts`.

**D-019 · 2026-10-31 · Una propuesta nueva se añade al final de `propuestas` y `obras` de la semilla, completa, y el código de la semilla no cambia. En una base con datos, el despliegue crea la propuesta y su obra, pero sus cifras y etapas quedan vacías y se llenan desde el panel antes de publicar.**
Por qué: la semilla añade lo que falta por clave (propuestas, obras, textos) y solo carga las listas (cifras, etapas, biografía, chat) en una tabla vacía; cambiar eso arriesgaría sobrescribir o resucitar lo que editan los administradores. El panel no crea propuestas, así que la semilla es su único camino. Si la propuesta enlaza un sitio propio, su tarjeta va en `proposalSites` de `frontend/src/lib/data/presentation.ts`, como los modelos 3D en `proposalModels`.

## Trabajo y configuración

**D-011 · 2026-10-03 · Despliegue con Docker Compose, GitHub Actions, GHCR y `server-produccion/desplegar.sh`; descartados Dokploy, Vercel y Jenkins.**
Detalle: `server-produccion/README.md`.

**D-012 · 2026-10-25 · `AGENTS.md` y `CLAUDE.md` se versionan como dos copias completas e idénticas.**
Por qué: Codex lee `AGENTS.md` y Claude Code `CLAUDE.md`; el responsable prefiere que cada herramienta tenga su archivo completo.

**D-013 · 2026-10-25 · La memoria de los agentes es local de cada equipo (`PROJECT_MEMORY.md`, fuera de Git); el contexto del código, un mapa de Graphify en `graphify-out/` (fuera de Git, salvo los nombres de sus subsistemas).**
Por qué: los agentes de una misma máquina comparten el contexto sin releer el proyecto. Lo que deba saber todo el equipo va a este registro o a `docs/`.

**D-014 · 2026-10-25 · Gestión de configuración ligera: versiones semánticas con tag y Release por versión, `CHANGELOG.md` por versión, plantilla de PR y este registro. Sin issues, tablero ni protección de `main` por ahora.**
Por qué: hay un solo desarrollador y los cambios se planifican con los clientes en otra herramienta. La protección de `main` se reconsiderará si entra más gente. Detalle: `docs/gestion-de-configuracion.md`.

**D-015 · 2026-10-28 · (Sustituida por D-016) En Claude Code, la lectura de la memoria y el uso del mapa de Graphify se imponen con hooks versionados en `.claude/`: al iniciar la sesión se cargan `PROJECT_MEMORY.md`, este registro y el resumen del mapa (con aviso si está desactualizado), y las búsquedas en el código (`Grep`, `Glob`, `grep`, `find`, `Select-String`…) se bloquean hasta que la sesión consulta `graphify`. Leer un archivo no se bloquea, y `Grep`/`Glob` quedan libres fuera del proyecto o dentro de un solo archivo.**
Por qué: como texto en `CLAUDE.md`, la regla se saltaba en preguntas que parecían simples y se leía el repositorio a ciegas. Las excepciones no dependen del criterio del agente: cubren solo lo que el mapa no conoce o no aporta. Solo cubre Claude Code; Codex sigue dependiendo de `AGENTS.md`. Detalle: `.claude/settings.json` y `.claude/hooks/`.

**D-016 · 2026-10-29 · Los hooks de Claude Code no se versionan: `.claude/` está en `.gitignore`, y el agente de cada equipo los crea a partir de la descripción de `AGENTS.md`/`CLAUDE.md` («Hooks de Claude Code»). Hacen lo mismo que en D-015.**
Por qué: son configuración de cada máquina, como `PROJECT_MEMORY.md` y el mapa de Graphify, y quien programa decide si los usa. La regla los describe con el detalle suficiente para que cualquier agente los cree igual.

**D-017 · 2026-10-29 · El proyecto no lleva fotos ni textos provisionales: las fotos de relleno (antes `frontend/src/assets/obras` y `assets/biografia`) viven solo en `design/recursos/fotos-provisionales/`, y cada sección sin foto muestra su propio aviso.**
Por qué: en local debe verse lo mismo que en producción, y el código que solo mostraba esas fotos iba a producción sin usarse. Las pruebas de Playwright usan registros como los de una foto subida, sin archivo (`frontend/src/lib/data/mock/fotos.ts`), y la prueba sirve la imagen (`frontend/tests/support/fotos.ts`). Regla «Contenido de ejemplo» en `AGENTS.md`/`CLAUDE.md`.
