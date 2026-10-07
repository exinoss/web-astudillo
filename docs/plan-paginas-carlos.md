# Plan de implementación: páginas de Carlos

**Fecha de revisión:** 6 de octubre de 2026.
**Estado:** plan aprobado e **implementado el 6 de octubre de 2026**, pendiente de desplegar. Las páginas empiezan vacías: el equipo de Carlos carga todo el contenido desde el panel (sección 11). Falta la prueba con enlaces reales en producción.
**Páginas:** «Por qué quiero ser alcalde» y «Conoce más sobre Carlos».

Este documento sustituye a la versión anterior del plan. Crearlo no supone aprobar los diseños ni autorizar la publicación de los textos y fotos de ejemplo.

## 1. Objetivo y reglas

Dar contenido y un propósito distinto a las dos páginas, con lectura breve: tarjetas editables, entrevista, galería y un video opcional por página. La información adicional se abre a petición del visitante.

El desarrollo sigue [AGENTS.md](../AGENTS.md) y [CLAUDE.md](../CLAUDE.md). Este plan no repite esas reglas; solo indica cómo se aplican aquí.

## 2. Decisiones de la revisión 2

| Tema | Decisión |
| --- | --- |
| Video | **Solo por enlace.** Facebook (videos y reels), TikTok, YouTube (también Shorts), Vimeo y un MP4 por enlace. Se reproduce **dentro de la página**, al pulsar la portada. No se suben archivos al servidor: sin FFmpeg, sin trabajador, sin biblioteca ni borrado de videos. |
| Formato del video | El panel detecta si es vertical (reels, TikTok, Shorts) u horizontal, y el administrador puede corregirlo. En escritorio, el video vertical va junto a su título y un texto breve opcional. |
| Reproducción | Sin reproducción automática. Antes de pulsar solo se descarga la portada, para ahorrar datos. |
| Tarjetas | **Duotono suave**, elegido entre cinco opciones con el cliente: la foto pasa de la sombra al color de la tarjeta, sin trama de puntos. Una foto distinta por idea, no el retrato de Carlos. |
| Colores de las tarjetas | Solo **rojo** (`#d81919`, sombra `#6e0400`) y **azul** (`#284e9c`, sombra `#001c48`). Las sombras son más oscuras que las de la6.org para que la foto se distinga. Sin selector de color libre ni intensidad editable. |
| Preparación de la foto | El servidor guarda una versión de la foto para la tarjeta: gris, contraste por percentiles 5–95 y curva en S. Sin ella, las fotos con color se ven planas. |
| «Leer más» | Texto amarillo subrayado con un «+» dentro de la tarjeta. Al abrir, el texto aparece **sobre la misma tarjeta, sin cambiar su tamaño**. |
| Numeración | `1, 2, 3…` según el orden, en la página y en el panel. |
| Composición | Un solo eje alineado a la izquierda. Cita destacada con barra roja y firma. Las dos páginas terminan con el mismo cierre: «Ver propuestas» y «Conoce mi trayectoria». |
| Ortografía | «video», sin tilde, como se usa en Ecuador. |

## 3. Prototipos

Están en [design/propuestas/paginas-carlos/](../design/propuestas/paginas-carlos/). Su [README](../design/propuestas/paginas-carlos/README.md) explica cómo abrirlos y resume la revisión 2. La revisión 1 se conserva en `design/propuestas/paginas-carlos-v1/`.

Con el servidor de desarrollo activo (`http://127.0.0.1:4337/`):

| Pantalla | Ruta |
| --- | --- |
| Índice | `/` |
| Por qué quiero ser alcalde | `/acerca-de-nosotros/por-que-quiero-ser-alcalde/` |
| Conoce más sobre Carlos | `/acerca-de-nosotros/conoce-mas/` |
| Panel · Tarjetas | `/panel/?tab=tarjetas` |
| Panel · Video | `/panel/?tab=video` |
| Comparación con la6.org | `/referencia-tarjetas/` |

Los textos, las fotos y el video son **ejemplos**. Las fotos de las tarjetas y de la galería vienen de Wikimedia Commons y solo sirven para el prototipo (créditos en `ejemplos/CREDITOS.md`). El retrato es un recorte de la pancarta existente; el original no se modificó. El video de ejemplo es un reel publicado por la campaña en Facebook.

Comprobado en la revisión 2: tipos del prototipo sin errores; sin desplazamiento horizontal a 390 y 1440 px; reel de Facebook, TikTok y YouTube reproducidos dentro de la página o del panel; tarjeta abierta del mismo tamaño que las cerradas. Quedan por revisar los ocho modos de accesibilidad y actualizar `herramientas/capturar.mjs`, que todavía prueba la subida de MP4 de la revisión 1.

`design/` está fuera de Git: los prototipos no se versionan con este documento.

## 4. Composición de las páginas

### 4.1 «Por qué quiero ser alcalde»

| Orden | Contenido |
| --- | --- |
| 1 | Título, cita destacada con firma y mensaje breve. |
| 2 | «Mis razones»: tres tarjetas rojas iniciales; hasta seis. |
| 3 | Video opcional con título y texto breve. |
| 4 | Cierre «Conoce las propuestas para San Lorenzo» → «Ver propuestas». |

La cita debe ser propia de esta página: la de la pancarta ya aparece en la portada y en la imagen para redes.

### 4.2 «Conoce más sobre Carlos»

| Orden | Contenido |
| --- | --- |
| 1 | Retrato amplio (4:5) junto a la presentación; en móvil, presentación y después retrato. |
| 2 | «Una conversación con Carlos»: tres preguntas iniciales; hasta seis, cerradas al entrar. |
| 3 | «Lo que me guía»: tres tarjetas azules iniciales; hasta seis. |
| 4 | «Momentos en imágenes»: galería. |
| 5 | Video opcional con título y texto breve. |
| 6 | Cierre «Conoce mi trayectoria» → biografía. |

La entrevista no debe repetir los valores de las tarjetas ni la biografía.

### 4.3 Fondo y espaciado

- Fondo con las cintas de la biografía (`backgruond-historia.png`) sobre base clara, con el encuadre móvil del prototipo.
- Contenido de hasta 850 px, inicio a 24–30 px bajo las migas, separaciones de 32–36 px entre secciones y final de página de hasta 56 px.
- Los cierres van sobre una superficie clara para leerse sobre las cintas.
- Las secciones sin contenido se omiten: ni reproductor vacío, ni galería con huecos, ni tarjetas de relleno.

## 5. Tarjetas

### 5.1 Composición

**Foto preparada en el servidor → duotono (filtro SVG) → sombra inferior → número y título en HTML → «Leer más».**

- Frente de 260 × 380 px en escritorio y de 200 × 300 px hasta 760 px. Esquinas de 16 px y separación de 16 px.
- Número amarillo arriba a la derecha; título amarillo regular abajo.
- Una sombra del color oscuro detrás de «Leer más», que es texto pequeño y necesita 4,5:1.
- Contraste del título amarillo: 3,2:1 sobre el rojo y 4,9:1 sobre el azul (mínimo 3:1 para texto grande); más alto sobre la sombra.
- La tarjeta pública y la vista previa del panel comparten componente.

### 5.2 Preparación de la foto

Al subir o cambiar la foto de una tarjeta, el backend genera con `sharp` una variante para tarjeta: escala de grises, `normalise` con percentiles 5–95, `gamma` y `linear` para la curva en S. Se guarda junto a las demás variantes optimizadas y es la que usa la tarjeta. La foto original y sus variantes normales siguen disponibles para otros usos.

Los valores exactos se fijan con las fotos reales del equipo, comprobando a tamaño 1x que la forma se reconoce.

### 5.3 Edición desde el panel

- Subir o sustituir la foto con el flujo actual de fotos optimizadas.
- Título (hasta 60 caracteres), texto (hasta 180) y descripción de la imagen (hasta 200).
- Punto de enfoque horizontal y vertical.
- Color: rojo o azul.
- Añadir, quitar y reordenar con botones accesibles por teclado; máximo seis.

### 5.4 Lectura y navegación

- Todo el frente es un `details/summary`. Al abrir, el texto aparece sobre la misma tarjeta con fondo oscuro y «Leer menos».
- Los títulos largos o el texto ampliado hacen crecer la tarjeta: nunca se recorta el texto.
- La tira se desplaza a mano: botones, deslizamiento y teclado. Sin avance automático.

## 6. Galería y entrevista

- **Galería:** en escritorio, collage de hasta tres fotos (una grande y dos apiladas); en móvil, una foto con botones y contador. «Ver todas» abre la vista ampliada, que mantiene el foco, se cierra con Escape y devuelve el foco. Máximo seis fotos, con descripción y pie editables. Solo fotos: las piezas con texto se recortan mal.
- **Entrevista:** pregunta de hasta 160 caracteres y respuesta de hasta 1000, como texto plano; máximo seis, con orden editable.

## 7. Video

### 7.1 Panel

Campos: título de la sección, texto breve opcional (hasta 200 caracteres), enlace, formato (horizontal o vertical) y portada. Botón «Ver video» para probarlo en la vista previa, «Guardar borrador» y «Quitar de la página».

Al escribir el enlace, el panel muestra el proveedor detectado o «Este enlace no es de un video admitido». En TikTok se pide el enlace completo del video, porque el corto (`vm.tiktok.com`) no se puede resolver en el navegador.

### 7.2 Enlaces admitidos y reproductor

| Proveedor | Enlaces | Reproductor |
| --- | --- | --- |
| Facebook | `facebook.com/reel/<id>`, `…/videos/<id>`, `watch?v=`, `fb.watch` | `facebook.com/plugins/video.php` |
| TikTok | `tiktok.com/@usuario/video/<id>` | `tiktok.com/player/v1/<id>` |
| YouTube | `watch?v=`, `youtu.be/`, `shorts/`, `embed/`, `live/` | `youtube-nocookie.com/embed/<id>` |
| Vimeo | `vimeo.com/<id>` y no listados con hash | `player.vimeo.com/video/<id>` |
| MP4 | URL HTTPS que termina en `.mp4` | `<video>` del navegador |

- El backend valida y guarda el **tipo, el identificador y el formato**, nunca el código HTML pegado. Rechaza otros protocolos, credenciales en la URL y dominios que imitan a un proveedor.
- El backend no descarga ni consulta los enlaces.
- La portada la sube el administrador con el flujo de fotos. Sin portada, se usa una imagen genérica de la campaña.
- Si el reproductor falla, se muestra «El video no está disponible», «Reintentar» y un enlace al video en su red.
- Facebook y TikTok pueden cambiar sus reproductores o retirar un video. Una prueba antigua no garantiza que siga disponible.

### 7.3 Contenido de terceros

Los reproductores de Facebook, TikTok, YouTube y Vimeo se cargan solo al pulsar. En ese momento esos servicios reciben la visita. Hay que mencionarlo en la política de privacidad (pendiente de la revisión legal del plan previo a la publicación) y ampliar la CSP con sus orígenes (`frame-src`) cuando se implemente la CSP completa.

## 8. Datos, API y publicación

### 8.1 Contenido por página

Bloque `acercaDeCarlos` en borradores y snapshots, con los slugs `por-que-quiero-ser-alcalde` y `conoce-mas`. Una fila por página con JSONB validado y versión, como el resto del contenido editable.

| Parte | Datos |
| --- | --- |
| Tarjeta | Referencia a la foto, descripción, título, texto, color (`rojo` o `azul`) y punto de enfoque. El orden es el del array. |
| Video | Título, texto breve, proveedor, identificador (o URL del MP4), formato y referencia a la portada. Puede ser `null`. |
| Retrato | Referencia a la foto y descripción. |
| Entrevista | Array ordenado de pregunta y respuesta. |
| Galería | Array ordenado de foto, descripción y pie. |

Los textos que ya existen conservan sus claves (`alcalde.titulo`, `alcalde.cita`, `conoce-mas.texto`…) sin duplicarse en el JSON. El campo nuevo es opcional al leer publicaciones anteriores: su ausencia da una estructura vacía y nunca inserta ejemplos.

### 8.2 Operaciones

| Método y ruta | Contrato |
| --- | --- |
| `GET /api/admin/contenido` | Añade las dos páginas con sus versiones. |
| `PUT /api/admin/contenido/acerca-de-carlos/:slug` | Guarda una página entera con la versión esperada; 409 si cambió. |
| `POST /api/admin/publicaciones` | Igual que ahora; el snapshot incluye las páginas. |
| `GET /api/contenido/publicado` | Snapshot ampliado de forma compatible. |

Permisos: los actuales de edición, subida de medios y publicación. La variante de tarjeta de la foto se genera en la subida de medios existente.

### 8.3 Garantías

- Repetir un guardado con el mismo contenido no duplica efectos; con otro contenido y versión antigua, 409 sin sobrescribir.
- Las referencias a fotos se comprueban dentro de la transacción. Una foto usada por una página no se puede borrar.
- Se rechazan propiedades desconocidas, slugs ajenos, colores fuera de `rojo`/`azul`, coordenadas fuera de 0–100, más de seis elementos, enlaces no admitidos y HTML.
- Pruebas de repetición y conflicto en cada operación nueva.

## 9. Fases

| Fase | Trabajo | Cierre |
| --- | --- | --- |
| 0. Diseño | Prototipos revisión 2. **Aprobado.** | — |
| 1. Datos | Tipos, migración, validación, snapshots y variante de tarjeta en `sharp`. | Pruebas de lectura anterior, validación, repetición y conflicto. |
| 2. Páginas | Componentes públicos, fondo, tarjetas, entrevista, galería y cierres. | Coincidencia con el prototipo aprobado. |
| 3. Video | Validación de enlaces, reproductores y estados de error. | Reel, video de Facebook, TikTok, YouTube, Shorts y Vimeo reales probados. |
| 4. Panel | Sección «Acerca de Carlos» en el panel existente. | Guardado, conflicto, vista previa y publicación sin regresiones. |
| 5. Entrega | `check`, `build`, Playwright, revisión visual y documentación. | Criterios de la sección 10. |

## 10. Criterios de aceptación

- [ ] Las dos páginas se distinguen desde la apertura y terminan con el mismo tipo de cierre.
- [ ] Las tarjetas usan el duotono con la foto preparada; la forma se reconoce a 1x en rojo y en azul.
- [ ] Título y número no se recortan con 60 caracteres ni con el texto ampliado; «Leer más» abre el texto en la misma tarjeta.
- [ ] La tira navega con botones, deslizamiento y teclado, sin avance automático.
- [ ] Videos de Facebook, TikTok, YouTube y Vimeo se reproducen dentro de la página solo al pulsar; el formato vertical u horizontal es correcto.
- [ ] Un enlace no admitido se rechaza en el panel y en el backend.
- [ ] Galería con una, dos, tres y seis fotos, sin huecos; vista ampliada accesible.
- [ ] Desde 320 px hasta escritorio, con cambios de orientación, sin desplazamiento horizontal.
- [ ] Ocho modos de accesibilidad, foco visible, `alt` y áreas táctiles de 44 px.
- [ ] Guardados repetidos y simultáneos se comportan según la sección 8.3.
- [ ] Publicaciones anteriores se leen sin el campo nuevo.
- [ ] `bun run check`, `bun run build`, `bunx playwright test` y las pruebas del backend sin errores.

## 11. Material que falta del equipo de Carlos

- [ ] Textos confirmados: cita, mensajes, razones, valores y entrevista.
- [ ] Un retrato real con fondo propio.
- [ ] Una foto por tarjeta que represente cada idea; mejor escenas o detalles de San Lorenzo que retratos.
- [ ] Fotos para la galería, con descripción y pie.
- [ ] El enlace del video de cada página y su portada.

## 12. Implementación (6 de octubre de 2026)

- **Backend:** migración `0010_acerca_de_carlos`, funciones `fn_about_carlos_*` y `fn_media_details`, servicio `content/services/about-carlos.ts`, ruta `PUT /api/admin/contenido/acerca-de-carlos/:slug` y contrato compartido `src/contracts/video.ts`. Cada foto subida genera además `<nombre>-tarjeta-760.webp`; al guardar una página se crea también para fotos anteriores.
- **Sitio:** todo lo de las dos páginas se llama «acerca-de-carlos». El HTML está en `frontend/src/lib/acerca-de-nosotros/acerca-de-carlos/`, un archivo por sección (`cabeceras.ts`, `tarjetas.ts`, `video.ts`, `galeria.ts`, `entrevista.ts`, `cierre.ts`), y `pagina.ts` las ordena. Lo usan las dos páginas, con su miga de pan a través de `components/acerca-de-nosotros/acerca-de-carlos/Contenedor.astro`; la vista previa del borrador es la general del panel ([plan-vista-previa.md](plan-vista-previa.md)). La tarjeta sola (`tarjeta.ts`) la usa también el editor del panel. Los datos llegan por `lib/data/acerca-de-carlos.ts`; las pruebas usan los datos de `lib/data/mock/acerca-de-carlos.ts`.
- **Panel:** pestaña «Acerca de Carlos» en `scripts/cuenta/panel/acerca-de-carlos/`: `index.ts` (página, secciones y guardado), un archivo por sección (`tarjetas.ts`, `video.ts`, `retrato.ts`, `entrevista.ts`, `galeria.ts`) y `comun.ts` con las piezas compartidas. Muestra la medida recomendada de cada foto junto a donde se sube (tarjeta 800 × 1170 px, retrato 800 × 1000 px, galería 1600 × 1200 px, portada de video 1080 × 1920 o 1280 × 720 px).
- **Privacidad:** la política menciona los reproductores de Facebook, TikTok, YouTube y Vimeo, que solo se cargan al pulsar.
- **Se mantienen** el antetítulo, el título, la cita y la nota actuales de cada página, editables como hasta ahora en «Textos y redes».
- **Verificación:** 83 pruebas del backend (incluidas repetición, conflicto simultáneo, validación, permisos, publicación y compatibilidad con publicaciones anteriores) y 86 de Playwright (incluidos los ocho modos de accesibilidad y anchos de 320 a 1440 px en las dos páginas); `check` y `build` sin errores.
- **Pendiente tras desplegar:** probar en producción un reel y un video de Facebook, un TikTok y un YouTube reales, y comprobar la vista previa de la tarjeta con fotos reales.

Fuera del alcance: subir archivos de video, conversión o almacenamiento de video en el servidor, reproducción automática, un editor visual libre, bibliotecas de UI y una cronología duplicada de la biografía.
