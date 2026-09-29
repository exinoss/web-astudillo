# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added

- Administración del contenido sin tocar el código. Todo cambio queda como borrador hasta que alguien pulsa «Publicar»; entonces el servidor regenera el sitio estático en cerca de un minuto, y si la compilación falla el sitio sigue con la versión anterior.
  - **Panel** en `/cuenta/panel/`: propuestas con sus cifras, línea de tiempo de la biografía con fotos, obras con hitos y fotos de evidencia, lista de textos del sitio, historial de publicaciones y usuarios. Se entra desde «Mi cuenta» con los permisos necesarios.
  - **Modo edición** sobre el propio sitio para los textos sueltos: contorno en cada texto editable, edición en línea en escritorio y en una hoja inferior en móvil. Solo lo descarga quien tiene permiso de edición. Los textos de los botones y los destinos de los enlaces no se editan.
  - **Roles**: un único admin maestro, que se crea y se transfiere solo por comando (`bun run admin:crear`, `bun run admin:transferir`); admin y coadmin editan y publican, y solo admin y maestro gestionan usuarios. En la gestión de usuarios hay filtros por texto, rol y estado, paginación, y activación o desactivación de cuentas (desactivar cierra sus sesiones).
  - **Fotos subidas**: se validan por contenido, se optimizan a WebP en tres anchos y se les quitan los metadatos EXIF, incluida la ubicación.
  - **Despliegue**: nginx sirve el sitio compilado, las fotos y la API; nuevo servicio `publicador` en Docker Compose.
- Franja de cifras (KPI) en la página de cada propuesta, con los datos que envió el cliente. Las de «Centro de alto rendimiento» son provisionales hasta que el cliente las confirme.
- Componente global de paginación para las listas del panel.
- Botón de pantalla completa en el visor 3D (API nativa; en iPhone, donde no existe, el visor ocupa la ventana y se cierra con el mismo botón o Escape). En pantalla completa el gesto vertical gira el modelo en vez de desplazar.
- Página «Obras en ejecución» en Ciudadanía: por cada propuesta muestra etapa, porcentaje de avance, nota, hitos y fecha de actualización. Los datos son de ejemplo y están marcados como provisionales; llegan por `contentRepository.getWorks()`. Cada obra ocupa una fila: la tarjeta de progreso y, al lado, un carrusel con las fotos de evidencia; en móvil las fotos quedan plegadas en un acordeón «Fotos del avance» bajo la tarjeta (en la semilla se toman de `src/assets/obras/<obra>-<n>.png`).
- Estructura inicial del repositorio (`frontend/`, `backend/`, `docs/`).
- Frontend (`frontend/`): migración completa del prototipo aprobado a Astro + Tailwind CSS v4, con paridad visual y funcional verificada (Playwright + comparación de capturas contra el prototipo).
- Capa de acceso a datos (`frontend/src/lib/data/`) con implementación local (mock) hoy y una implementación HTTP lista para conectarse al backend vía `PUBLIC_DATA_SOURCE`.
- `backend/README.md`: contrato de entidades y endpoints propuestos para cuando se implemente la API.
- Efecto de cortina de cristal en el carrusel de retrato: un panel translúcido sube y baja sobre la tarjeta, delimitado por una línea luminosa.
- Modelo 3D interactivo en la página de «Tecnologías emergentes» (`<model-viewer>`): se gira y se acerca, se carga solo al entrar en pantalla y respeta «Reducir movimiento» y el ahorro de datos del navegador. `bun run modelos` optimiza los `.glb` de `frontend/modelos-fuente/` hacia `frontend/public/models/`: el primero pasa de 2,69 MB a 282 KB (79 KB servido con gzip).
- Animaciones Lottie de la campaña con `lottie_light` (≈47 KB gzip, alojado en el sitio y cargado bajo demanda con reintento): la urna de «Lista 6» cubre los formularios de cuenta y ciudadanía mientras se envían o cargan datos, y la papeleta marcada acompaña la navegación entre páginas: se navega al completar una vuelta (≈0,9 s) mientras la página destino se precarga. El loader solo aparece si el envío tarda más de 200 ms. Con «Reducir movimiento» el loader queda en un fotograma fijo y la navegación no se retrasa; con ahorro de datos no se descargan.
- «Acerca de nosotros» pasa a desplegable en el menú, con tres páginas propias: Biografía, Por qué quiero ser alcalde y Conoce más sobre Carlos. La Biografía es una línea de tiempo de 6 hitos (a partir de la de la6.org) con años, textos y fotos provisionales. La portada de la sección enlaza esas tres páginas con un índice numerado. En la Biografía, la cinta del fondo queda fija mientras se recorre la línea de tiempo.

### Changed

- El avance de cada obra se calcula con sus hitos (completados ÷ total) en vez de escribirse a mano. La etapa es «Por iniciar» al 0 %, «Terminada» al 100 % y «En ejecución» en el resto; desaparece «Planificación». Con los datos de ejemplo, Agua potable pasa de 45 % a 60 %.
- Espaciado vertical más ajustado en todas las páginas interiores (propuestas, Ciudadanía, Obras, cuenta, «Acerca de nosotros», Biografía y 404): el contenido empieza a 24-32 px bajo la cabecera, las cabeceras naranjas bajan de 55-65 px a 40 px de relleno y los finales de página de 80-96 px a 56 px. El pie queda siempre al fondo de la ventana, sin alturas mínimas de relleno. Las secciones de la portada conservan sus 96 px.
- El botón azul de la cabecera pasa de «Reportar daño» a la cuenta: muestra «Iniciar sesión» o «Mi cuenta» según la sesión, y sale del menú para no repetirse. Reportar un daño sigue en Ciudadanía › Alerta ciudadana.
- Carrusel principal: los puntos pasan a una pastilla dentro del propio carrusel, con flechas de anterior y siguiente (a los lados en escritorio y junto a los puntos en móvil). Se retiran la franja superior «Carlos Astudillo · Candidato a alcalde» y la barra naranja de controles.
- El botón de accesibilidad pasa a la esquina inferior derecha y su panel se abre hacia arriba; queda por debajo de «Volver arriba» y en móvil el pie reserva espacio para que no se solapen.
- Los estilos se reparten en 14 archivos por componente (`base`, `header`, `hero`, `about`, `contact`…) en vez de un único `global.css` de 2439 líneas; `global.css` queda como punto de entrada con los `@import` y el `@theme`.
- Las cadenas de utilidades que se repetían en el markup se consolidan en las clases `.eyebrow`, `.button` y `.button-light`.

### Removed

- Dependencia `daisyui`: no se usaba ninguna de sus clases ni su mecanismo de temas; sus tokens de color pasaron a `@theme`.
