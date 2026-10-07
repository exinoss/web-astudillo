# Plan: vista previa del borrador

Estado: **implementado** (6 oct 2026). Pendiente: medir el tiempo en el VPS tras desplegar.

## 1. Objetivo

Que el equipo vea el sitio entero tal como quedará antes de publicar, desde cualquier pestaña del panel. Hoy solo «Acerca de Carlos» tiene vista previa, y lo consigue con una página y un script propios.

Esta vista previa sirve para todas las páginas sin crear un archivo por pestaña. Cuando funcione, se borran la vista previa propia de Acerca de Carlos (`pages/cuenta/acerca-de-carlos/` y `scripts/acerca-de-carlos/vista-previa.ts`) y su prueba se adapta.

## 2. Cómo funciona

1. En el panel, el botón «Vista previa del borrador» pide la vista previa y muestra «Preparando la vista previa…».
2. El backend congela el borrador actual, igual que al publicar pero sin publicar nada, y lo deja en cola.
3. El publicador compila con ese contenido una copia del sitio en una carpeta aparte, `vista-previa/`, junto a `dist/`. Las publicaciones reales tienen prioridad.
4. Cuando termina, el panel abre la página que se estaba editando en una pestaña nueva. Mientras dure el modo vista previa, en ese navegador **todo el sitio** se ve con el borrador, con una franja fija arriba: «Estás viendo el borrador · Salir de la vista previa».
5. Si el borrador no cambió desde la última vista previa, se abre al momento, sin compilar otra vez.

## 3. Piezas

### Base de datos
- Una tabla nueva, `tb_vista_previa`, con una sola fila: estado (`en_cola`, `compilando`, `lista`, `fallida`), contenido congelado, versión (md5 del contenido), quién la pidió, cuándo y el detalle del error.
- Funciones nuevas:
  - `fn_preview_request`: con `pg_advisory_xact_lock`, si el contenido es el mismo y está en cola, compilando o lista, devuelve el estado sin repetir nada (doble clic y reintentos seguros);
  - `fn_preview_state`;
  - `fn_preview_claim`;
  - `fn_preview_finish`: solo marca «lista» si nadie pidió otra versión mientras compilaba.

### Backend
- `POST /api/admin/vista-previa`: pide la vista previa. Requiere sesión y el mismo permiso que editar contenido.
- `GET /api/admin/vista-previa`: el estado, que el panel consulta cada pocos segundos.
- `GET /api/admin/vista-previa/acceso`: lo usa nginx (`auth_request`) en cada página de la vista previa. Responde 204 si la sesión tiene permiso y 401 si no.
- `GET /api/admin/vista-previa/salir`: quita la cookie del modo vista previa y vuelve al panel.
- La cookie `vista_previa` solo dice qué carpeta servir. La seguridad está en la comprobación de la sesión en cada petición.

### Publicador
- Después de las publicaciones, recoge la vista previa en cola.
- El contenido lo lee de la base, porque el publicador ya tiene acceso. Lo pasa a la compilación en un archivo temporal, sin abrir ningún endpoint nuevo con el borrador.
- Compila en `vista-previa/` con el mismo cambio atómico que usa para `dist/`.

### Frontend
- `lib/data/index.ts` elige el repositorio: pruebas (mock), compilación de la vista previa (repositorio que lee el archivo temporal) o publicado (HTTP). Sigue pasando todo por `lib/data/`.
- La compilación de vista previa añade la franja superior y `noindex`.
- En el panel hay un solo botón compartido, en `scripts/cuenta/panel/ui.ts`, que usan todas las pestañas. Sustituye a los «Ver en el sitio» y al enlace actual de Acerca de Carlos.

### nginx (producción)
- Si llega la cookie `vista_previa`, las páginas y `/_astro/` se sirven desde `vista-previa/` tras comprobar la sesión con el backend.
- `/api/`, `/medios/` y `/cuenta/` no cambian.
- Los visitantes sin la cookie no notan nada: ni una petición de más.
- Las respuestas de la vista previa llevan `Cache-Control: private, no-store` para que Cloudflare no las guarde.

### En local
- El publicador deja la vista previa en `frontend/dist-vista-previa/` (ignorada por git y por `astro dev`).
- El mismo `bun run dev` la sirve: `frontend/vista-previa-local.mjs` hace en desarrollo lo que nginx en producción (misma cookie, misma validación con el backend, `/cuenta/`, `/api` y `/medios` sin tocar). No se carga al compilar.

## 4. Tiempos y costes

- **Tiempo:** cada vista previa tarda lo que una compilación del sitio, más hasta 3 s de espera del publicador. En local la compilación completa tarda 2,9 s; generar las 28 páginas son 1,5 s y el resto es trabajo fijo. Compilar solo la página editada no compensa: ahorraría poco más de un segundo y los enlaces a las demás páginas no funcionarían. En el VPS hay que medirlo. Si el borrador no cambió, es instantánea.
- **Disco:** una copia más del sitio estático, de unos pocos MB.
- **Vista previa compartida:** hay un solo borrador compartido, así que hay una sola vista previa. Si dos personas la piden a la vez con el mismo borrador, se compila una vez; si el borrador cambió, gana la última petición.

## 5. Pruebas

- **Backend:**
  - pedir dos veces el mismo borrador no duplica la compilación;
  - pedir con otro borrador mientras compila deja la nueva en cola;
  - una cuenta sin permiso recibe 403 y el acceso de nginx devuelve 401.
- **Publicador:** compila la vista previa y no toca `dist/`.
- **Playwright:** el botón queda bloqueado mientras se prepara, muestra el estado y abre la página.
- **nginx:** se prueba con un contenedor temporal (con cookie y sesión, con cookie y sin sesión, sin cookie), que se borra al terminar.

## 6. Implementación: cambios respecto a la propuesta

- **Pase propio en vez de la sesión.** La cookie de sesión (`access`) solo viaja a `/api` y dura 10 minutos, así que nginx no puede usarla en las páginas. Al entrar, el backend da la cookie `vista_previa`: un JWT firmado de 2 horas con su propia audiencia. nginx lo valida en cada página con `GET /api/vista-previa/acceso`, que además comprueba que la cuenta siga activa y con permiso para editar. `salir` también va fuera de `/api/admin/`.
- **Carpetas.**
  - La compilación queda en `dist-vista-previa/`, siguiendo el patrón `dist-*`.
  - Sus archivos van en `/_astro-vista-previa/`. Así el panel, que se sirve siempre del sitio publicado, nunca carga scripts de la vista previa, aunque esa compilación sea de una versión anterior del código.
- **Página de espera.** El botón abre al momento una pestaña en `/cuenta/vista-previa/?ruta=…`, que pide la vista previa, espera y entra; así el navegador no bloquea la ventana nueva. Hay una sola página para todo el panel.
- **Tabla sin columna de versión.** La comparación se hace con el contenido completo (`jsonb =`), como en las publicaciones.
- **Franja.** Va arriba del todo y queda fija al hacer scroll, con la cabecera debajo; en móvil ocupa dos o tres líneas. Los enlaces a `/cuenta/` (como «Iniciar sesión» o «Mi cuenta») se ven con rayas diagonales y no responden: llevarían fuera de la vista previa sin cerrarla. Para salir está «Salir de la vista previa». Con el mismo estilo quedan bloqueados los envíos de participación (enviar alerta, sugerencia o consulta del chat, preguntas rápidas y micrófono, marcados con `data-envia`): desde la vista previa no se crea ningún dato real. Los campos se pueden rellenar para ver cómo quedan.
- **Botones del panel.** Sustituyen a los enlaces que ya había: «Ver en el sitio» de biografía, obras, chat y propuestas, y el de Acerca de Carlos. Textos, redes y publicaciones no tenían enlace y no se les añadió ninguno. Se desactivan si no hay ningún cambio sin publicar, en ninguna pestaña, y se activan en cuanto se guarda uno.
- **Una sola pestaña.** La vista previa se abre siempre en la misma pestaña, con nombre fijo: si ya hay una abierta, se reutiliza. «Salir de la vista previa» borra el pase, cierra esa pestaña y deja el panel donde estaba; si la vista previa no la abrió el panel, va al panel en la misma pestaña.
- **Solo para mirar.** En la vista previa no se carga la barra de edición del sitio (ni publicar, ni editar textos); se edita y se publica en el panel. El contenido sí funciona: videos, carruseles, tarjetas, galería, menús y accesibilidad.
- **Al arrancar el publicador** se vuelve a poner en cola la vista previa lista, para que tras un despliegue no se vea con el código anterior.
- **Pruebas.**
  - Backend: `tests/preview.test.ts`.
  - Playwright: `tests/vista-previa.spec.ts`.
  - nginx: probado con un contenedor temporal con la configuración real (con pase, sin pase, pase falso, `/cuenta/`, archivos, 404 y salir).
