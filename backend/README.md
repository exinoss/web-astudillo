# Backend — Carlos Astudillo

API de autenticación, contenido y participación ciudadana en Bun, Elysia y PostgreSQL. El cliente HTTP de Astro apunta a estas rutas bajo `/api` en el mismo origen.

## Preparación

1. Instalar dependencias en `backend/` con `bun install`. Copiar `.env.example` a `.env` y completar: `DATABASE_URL`, `APP_ORIGIN`, `JWT_SECRET` (al menos 32 caracteres aleatorios), `GOOGLE_CLIENT_ID` y las variables `SMTP_*`. Las seis variables SMTP ya están en el `.env` local; todavía hay que comprobar que el remitente esté autorizado y que los mensajes lleguen. No publicar el archivo ni compartir sus valores.
2. Con `DATABASE_URL` apuntando a PostgreSQL, ejecutar `bun run db:migrate` desde `backend/`. Drizzle aplica las migraciones versionadas generadas desde los modelos de `src/db/schema.ts`; el comando también aplica `database/fn.sql` y `database/datains.sql`. En una base existente sin historial Drizzle, valida las tablas y columnas modeladas y registra la migración inicial como aplicada sin volver a crear las tablas. No se necesita un `bd.sql` separado.
3. Crear un cliente OAuth **web** de Google y autorizar `http://localhost:4321` para desarrollo. Copiar el mismo ID a `GOOGLE_CLIENT_ID` aquí y `PUBLIC_GOOGLE_CLIENT_ID` en Astro; un ID de ejemplo no permite acceso real.
4. Ejecutar `bun run dev` desde `backend/`. Por defecto escucha en `127.0.0.1:3000`. `APP_ORIGIN` debe ser `http://localhost:4321` en desarrollo, el origen que verá el navegador. Astro envía `/api` al backend. En producción, servir `/api` desde el mismo sitio mediante un proxy HTTPS. El proceso falla al arrancar si faltan variables obligatorias, PostgreSQL no responde o hay migraciones pendientes.

### Correo local con Mailpit

Ejecutar `bun run mailpit` desde `backend/`, aparte de `bun run dev`. El comando lanza `docker compose -f compose.mailpit.yml up -d` y reintenta cada 2 segundos mientras Docker no responda, por ejemplo si el puente hacia el daemon de WSL aún no está arriba. Termina cuando el SMTP acepta conexiones y deja el contenedor en marcha. Para detener los reintentos, pulsa Ctrl+C. La bandeja queda en `http://localhost:8025` y SMTP en `127.0.0.1:1025`. Para cambiar entre Mailpit y SMTP de Google, activar el bloque `SMTP_*` correspondiente en tu `.env` y reiniciar el backend. Mantener un solo bloque activo; no hace falta otro archivo de variables.

## Flujos

- **Correo y contraseña:** `POST /api/auth/register` recibe `nombresCompletos`, `correo`, `contrasenia`, `confirmarContrasenia` y `direccion?`. Comprueba ambas contraseñas y guarda una solicitud temporal con hash Argon2id, sin crear ni reservar usuario. El enlace dura 30 minutos y abre Astro; esa página llama a `POST /api/auth/verify-email` solo con el token: el enlace vale en cualquier navegador. El correo pide ignorarlo a quien no lo haya solicitado (si alguien registra un correo ajeno, su dueño puede recuperar la cuenta con «Olvidé mi contraseña»). Solo entonces crea usuario Votante e identidad de correo en una transacción. La persona inicia sesión después con `POST /api/auth/login`.
- **Google:** `POST /api/auth/google` recibe `{ credential }`, valida el ID token y busca primero el `sub`. Solo acepta cuentas cuyo correo sea de Google (`@gmail.com` o del dominio de Google Workspace de la cuenta), porque es lo único que Google garantiza: si ya existe un usuario con ese correo, vincula Google a él; si no, lo crea. Una cuenta de Google hecha con otro correo (Outlook, Hotmail…) recibe 422 «Entra con tu correo y contraseña»; no hay confirmación por correo. Las cuentas que ya estaban vinculadas siguen entrando por su `sub`. Una cuenta nacida con Google puede añadir contraseña mediante `POST /api/auth/password`, con sesión activa y reautenticación Google.
- **Sesiones:** las respuestas de acceso establecen cookies `access` (JWT, 10 minutos) y `refresh` (token opaco, 7 días), `HttpOnly` y `SameSite=Lax`; en producción también `Secure`. `POST /api/auth/refresh` rota el hash de renovación y extiende la expiración de la sesión otros 7 días desde cada renovación; `POST /api/auth/logout` la revoca. Una copia del JWT de acceso puede funcionar hasta que venza, incluso tras cerrar sesión. Las rutas de perfil comprueban que el usuario siga activo.
- **Recuperación:** `POST /api/auth/password/reset-request` envía un enlace de un solo uso para cuentas con identidad de correo. `POST /api/auth/password/reset` cambia el hash y revoca todas sus sesiones. Una cuenta solo Google no recibe una contraseña a través de este flujo.
- **Cambio de contraseña:** `POST /api/auth/password/change` requiere sesión, permiso `cuenta.contrasenia.cambiar`, `contraseniaActual`, `contraseniaNueva` y `confirmarContrasenia`. Comprueba la contraseña actual, actualiza el hash, revoca todas las sesiones y borra las cookies del navegador. La cuenta vuelve a iniciar sesión.
- **Repeticiones y peticiones simultáneas:** todas las escrituras son seguras ante doble envío. Los enlaces por correo (registro, recuperación, acceso por enlace) son uno solo válido por correo y finalidad: si ya se pidió uno hace menos de un minuto no se envía otro, y uno nuevo anula los anteriores. Verificar, restablecer, añadir o cambiar la contraseña con los mismos datos por segunda vez responde como la primera, sin tocar nada. Si dos pestañas renuevan la sesión a la vez con el mismo `refresh`, la segunda (dentro de 30 s) recibe un acceso nuevo sin rotar, en lugar de cerrar la sesión. Una foto con el mismo contenido (SHA-256) se reutiliza en vez de duplicarse. El enlace de acceso no vuelve a iniciar sesión si ya se usó; la página comprueba si ya hay sesión.
- **Perfil:** `GET /api/me` y `PATCH /api/me` requieren acceso válido. `GET` incluye `tieneContrasenia` y `tieneGoogle` para mostrar los métodos de acceso disponibles. El cambio admite solo `nombresCompletos` y `direccion?`; no admite correo, rol ni estado. No hay API pública para cambiar roles.

Las contraseñas nuevas requieren al menos 6 caracteres, una letra, un número y un símbolo; internamente se limitan a 128 para que nadie pueda saturar el cálculo del hash con un texto enorme (los formularios no dejan escribir más). Se aplica al registro, recuperación, alta desde Google y cambio; el acceso sigue aceptando contraseñas existentes. Es la política solicitada para este proyecto, aunque [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) recomienda un mínimo de 15 caracteres cuando la contraseña es el único factor y desaconseja las reglas de composición.

La API responde con errores genéricos en acceso y solicitudes de correo, limita los intentos (ver «Límite de intentos»), comprueba el encabezado `Origin` en escrituras y no registra contraseñas ni tokens. Los JWT se validan sin consultar `tb_sesiones` en cada petición; las acciones administrativas futuras deberán consultar el rol actual en la base. Las notas sobre enlaces antiguos y funciones pendientes están en [integraciones-pendientes.md](../docs/integraciones-pendientes.md).

## Correos

`src/mailer.ts` envía los correos de cuenta con la plantilla de `src/mail/plantilla.ts` (`MENSAJES.verificar`, `recuperar` y `acceso`): HTML de tablas con estilos en línea, versión de texto y las imágenes de `assets/correo/` incrustadas como adjuntos CID, que se ven sin depender de que el sitio sea accesible. El diseño aprobado y su generador de maquetas están en `design/propuestas/correo/`. Para verlos en local, Mailpit (`bun run mailpit`, bandeja en `http://localhost:8025`).

## Límite de intentos

Sigue la guía de OWASP: varias claves a la vez, sanción progresiva, solo cuentan los fallos y el dueño nunca queda fuera. Los fallos de contraseña (inicio de sesión y cambio de contraseña) se guardan en `tb_limites_intentos` (`src/auth/services/limits.ts`, `createAttempts`; escalada en `fn_limit_fail`):

| Clave | Frena | Escalada |
| --- | --- | --- |
| `par:correo\|IP` (`cambio:usuario\|IP` al cambiar) | fuerza bruta contra una cuenta | 5 fallos libres → 1 min, 5 min, 15 min, 1 h, 6 h → 3 días (bloqueo mortal) |
| `ip:IP` | correos y contraseñas al azar | 20 libres → misma escalada |

- Las esperas de 1 min a 6 h son para cualquiera, también el dueño que se olvidó la contraseña, y afectan **solo a esa pareja**: desde la misma IP se puede entrar con otro correo.
- **Bloqueo mortal** (3 días, el tope): quien llega se trata como atacante. Esa IP queda bloqueada 3 días también para cualquier otro correo (`fn_limit_block`).
- **Ataque desde varios sitios:** si 2 o más IPs tienen bloqueo mortal vigente sobre un mismo correo (`fn_limit_attackers`), el dueño termina de entrar con un enlace a su correo. Con un solo atacante entra normal desde su IP.
- Los bloqueos se comprueban antes de calcular el hash; los intentos durante un bloqueo no suman. Un bloqueo vigente cuenta aunque su último fallo tenga más de 24 h; si pasan 24 h sin fallar y sin bloqueo, el contador vuelve a cero.
- Un acierto limpia solo su pareja `correo|IP`: el atacante sigue bloqueado aunque el dueño entre desde otra IP, y la IP no se reinicia con una cuenta propia.
- Con el correo en modo enlace, `POST /api/auth/login` responde siempre `{ enlace: true }` (contraseña buena o mala) y solo con la buena envía un enlace de un solo uso de 15 minutos a `/cuenta/acceso/`, que se confirma con `POST /api/auth/login/confirm`. Usarlo, o restablecer la contraseña, limpia las parejas de ese correo; las IPs con bloqueo mortal siguen bloqueadas.
- El 429 lleva la cabecera `Retry-After` y `{ error, reintentarEn }`; en el primer bloqueo del acceso añade `sugerirRecuperacion`. El mensaje es genérico.
- Como máximo se calculan 8 hashes Argon2id a la vez; si llegan más, responde 503 «inténtalo en unos segundos».
- Registro, recuperación, verificación y Google conservan límites por cantidad en memoria (una instancia), también con `reintentarEn`.

## Datos, migraciones y permisos

`src/db/schema.ts` es la fuente del esquema y también deriva los tipos de filas de `src/db/types.ts`. Para un cambio de tablas, modifica el modelo y ejecuta `bun run db:generate`; revisa y conserva el SQL generado en `drizzle/`, luego aplica con `bun run db:migrate`. Nunca edites una migración ya aplicada: genera una migración nueva. No hay un `bd.sql` paralelo que pueda quedar desactualizado. `drizzle-kit` compara los modelos con el snapshot previo y genera cada cambio; la integración existente a una base ya creada se adopta automáticamente una sola vez tras comprobar tablas y columnas.

Las rutas llaman a servicios, y los servicios invocan funciones PostgreSQL con `callPg()` de `src/db/call.ts`. El ejecutor acepta solo nombres de una lista interna y pasa los argumentos como parámetros. Las funciones están en `database/fn.sql`; los roles y permisos iniciales están en `database/datains.sql`. El catálogo de permisos usado por rutas y servicios está en `src/auth/permissions.ts`; el tipo `Permission` se deriva de sus valores, así no se mantiene una unión manual aparte. Al agregar un permiso, se agrega al catálogo, se define su asignación por rol en `database/datains.sql` y las rutas lo solicitan con `PERMISSIONS.*`. Las comprobaciones dentro de funciones sensibles de `fn.sql` repiten el permiso de esa operación para validar el acceso también en la capa de PostgreSQL.

Visitante es anónimo y no tiene acceso al perfil. `perfil.ver`, `perfil.editar`, `cuenta.contrasenia.agregar` y `cuenta.contrasenia.cambiar` se asignan inicialmente a Votante, Analista, Coadmin y Admin porque son las únicas capacidades autenticadas implementadas. La autorización consulta el rol, estado y permiso actuales en PostgreSQL: sin sesión responde 401 y sin permiso responde 403. Las futuras funciones del sitio deberán definir nuevos permisos y asociarlos a sus rutas; no hay un endpoint público para asignarlos.

## Administración

Roles internos, de más a menos poder:

- **Admin maestro**: uno solo en todo el sistema (lo garantiza un índice único en la base). Puede cambiar el rol de cualquier cuenta, incluido bajar un admin a coadmin. Nadie puede cambiar su rol desde la web.
- **Admin**: edita y publica contenido, sube votantes a coadmin o admin y baja coadmins. No puede cambiar a otro admin ni su propio rol.
- **Coadmin**: edita y publica contenido; no gestiona usuarios.

El maestro se gestiona solo por comando, desde `backend/` y con `DATABASE_URL` configurada:

- `bun run admin:crear` pide correo, nombre y contraseña (sin mostrarla) y crea el maestro. Se niega si ya existe uno o si el correo ya tiene cuenta.
- `bun run admin:transferir <correo>` pasa el rol de maestro a una cuenta activa y deja al anterior como admin normal, en una sola transacción. La persona debe estar registrada antes.

`GET /api/admin/usuarios` (`usuarios.ver`) admite `q` (nombre o correo), `rol`, `estado` (`activo` o `bloqueado`) y `pagina`; responde `{ total, pagina, porPagina, usuarios }` con 20 cuentas por página, y cada cuenta trae `rolesAsignables`, `puedeCambiarEstado` y `motivoBloqueo` calculados para quien consulta. `PATCH /api/admin/usuarios/:id/rol` (`usuarios.rol.cambiar`, cuerpo `{ rol, rolAnterior }`) cambia el rol y `PATCH /api/admin/usuarios/:id/estado` (`usuarios.estado.cambiar`, cuerpo `{ estado, estadoAnterior }`) activa o desactiva la cuenta. `rolAnterior`/`estadoAnterior` es lo que mostraba la lista: si otro admin cambió la cuenta mientras tanto responde 409; pedir lo que ya tiene es idempotente; desactivar revoca sus sesiones y el acceso vigente deja de servir de inmediato. La regla está en `src/admin/services/hierarchy.ts` y se repite en `fn_role_change` y `fn_user_state_change` dentro de PostgreSQL; cada cambio queda en `tb_auditoria`. `GET /api/me` incluye `rol` y `permisos` para que el frontend muestre solo lo permitido.

Las respuestas de cuenta y del listado de usuarios no incluyen `esMaestro`, tampoco al consultar como maestro. El indicador `es_maestro` se conserva en PostgreSQL y en las comprobaciones internas de jerarquía; el índice único y la creación o transferencia por comando siguen vigentes. El orden de la lista no identifica al maestro y los bloqueos de jerarquía usan un mensaje genérico.

## Contenido y publicación

Coadmin y admin editan el contenido desde `/cuenta/panel/` (propuestas y sus KPI, biografía, obras, usuarios) y los textos sueltos sobre el propio sitio, con el modo edición. Todo se guarda como **borrador** en las tablas `tb_textos`, `tb_propuestas`, `tb_propuesta_kpis`, `tb_biografia_hitos`, `tb_obras`, `tb_obra_hitos` y `tb_obra_fotos`; el sitio público no cambia hasta que alguien pulsa «Publicar».

- **Textos**: solo se aceptan las claves del registro `frontend/src/lib/contenido/textos.ts` y texto plano (se rechaza cualquier marca HTML y los caracteres de control). Guardar `null` devuelve el texto al del diseño.
- **Redes sociales**: claves `enlace.facebook`, `enlace.tiktok` y `enlace.whatsapp`, guardadas como textos (misma versión y publicación). Facebook y TikTok solo aceptan `https://` a su propio dominio, para que nada como `javascript:` llegue a un `href`; WhatsApp acepta el número como se marca (`0985658595`, `+593 98 565 8595`) y lo guarda como `593985658595` para `wa.me`.
- **Chat** (`PUT /api/admin/contenido/chat`, cuerpo `{ respuestas, version }`): lista completa de preguntas frecuentes (pregunta, palabras clave, respuesta, enlace opcional a una página del sitio y si es botón de respuesta rápida), con la misma versión que la biografía. Va en la publicación como `chat`.
- **Fotos** (`POST /api/admin/medios`, permiso `medios.subir`): JPEG, PNG o WebP de hasta 8 MB, comprobados por su contenido. `sharp` las gira según su orientación, genera variantes WebP de 480, 960 y 1600 px y **elimina los metadatos EXIF** (incluida la ubicación GPS). Se guardan en `MEDIA_DIR` con un nombre que nunca se reutiliza, y la base guarda solo el nombre y los anchos. En desarrollo el backend las sirve en `/medios/`; en producción las sirve nginx.
- **Avance de obras**: no se guarda. Se calcula a partir de los hitos (`frontend/src/lib/obras.ts`): 0 % es «Por iniciar», 100 % «Terminada» y el resto «En ejecución».
- **Versiones y conflictos**: `GET /api/admin/contenido` devuelve también `versiones` (md5 del estado de cada texto, propuesta, obra y de la biografía, calculado en PostgreSQL). Cada `PUT` envía la `version` que cargó: si otra persona guardó antes responde 409 y no escribe; si el contenido ya es el enviado responde 200 sin tocar nada (repetir es seguro). La comparación ocurre dentro de la función SQL, bajo `pg_advisory_xact_lock`.
- **Publicar** (`POST /api/admin/publicaciones`, permiso `contenido.publicar`): congela todo el borrador como JSON en `tb_publicaciones`. Es idempotente: si ese mismo contenido ya está en cola o compilándose, devuelve esa publicación (doble clic o varias personas a la vez no la duplican). Si hay una en cola con otro contenido, la sustituye. Responde 409 si no hay cambios respecto a la última publicada. Lo pendiente se calcula contra lo último enviado a publicar, así deja de aparecer en cuanto se pulsa «Publicar».

- **Contenido vigente** (`GET /api/contenido/publicado`, público): el que se está compilando o, si no hay, el último publicado; 404 si nunca se publicó. Nunca devuelve borradores. El frontend lo lee en `bun run dev` (en cada recarga) y en `bun run build`; sin publicaciones usa la semilla del código.

El **publicador** (`bun run publicador`) toma la publicación en cola y ejecuta `bun run build` del frontend, que lee esa publicación de la API. Compila en `frontend/dist-nueva` y, solo si termina bien, la pasa a `<SITE_DIR>/dist` y la marca como publicada (si `SITE_DIR` es otro disco, como el volumen de nginx, primero copia la compilación allí; el cambio final siempre es un rename atómico). Si falla, queda como fallida y tanto `dist` como la API siguen con la versión anterior; el panel muestra un mensaje genérico y el registro técnico queda en la base. Variables: `DATABASE_URL`, `FRONTEND_DIR` (por defecto `../frontend`), `SITE_DIR` (por defecto, la carpeta del frontend) y `API_PROXY_TARGET` (dirección del backend, por defecto `http://127.0.0.1:3000`).

En local: backend (`bun run dev`), `bun run publicador` y el frontend (`bun run dev`). Al pulsar «Publicar», cuando el panel la marca como publicada basta recargar la página.

## Participación ciudadana

Alertas, sugerencias y chat requieren sesión (permiso `participacion.enviar`, que tienen todas las cuentas). Sin sesión responden 401 y el sitio guarda lo escrito para enviarlo tras iniciar sesión.

- **Alertas** (`POST /api/participacion/alertas`, multipart): `idempotencia` (UUID que genera el navegador), `tipo` (agua, basura, alumbrado, baches, seguridad u otro), `sector`, `referencia` opcional, `descripcion` (mínimo 10 caracteres) y `foto` opcional de hasta 5 MB. Repetir el envío con la misma `idempotencia` devuelve la misma alerta, también si llegan a la vez (`ON CONFLICT` en la base). La foto pasa por el mismo proceso que las del panel (formato por contenido, sin EXIF ni GPS) y se guarda en **`MEDIA_PRIVADA_DIR`**, que nginx no sirve: solo la entrega `GET /api/participacion/fotos/:archivo` a quien envió la alerta o a quien tiene `participacion.ver`; para el resto responde 404. Su nombre sale del SHA-256 de la imagen, así la misma foto no se guarda dos veces.
- **Sugerencias** (`POST /api/participacion/sugerencias`, JSON): `idempotencia`, `tema` (slug de una propuesta u `otro`) y `mensaje` (mínimo 15 caracteres).
- **Historial**: `GET /api/participacion/alertas/mias` y `…/sugerencias/mias` devuelven las últimas 20 propias con su estado.
- **Chat** (`POST /api/participacion/chat`, `{ mensaje }`): elige la pregunta frecuente **publicada** cuyas palabras clave más aparecen en el mensaje (sin tildes ni mayúsculas; una palabra clave de 4 letras o más vale como raíz). Si ninguna coincide responde con un texto genérico y anota la pregunta en `tb_chat_sin_respuesta`, que el panel muestra (`GET /api/admin/chat/sin-respuesta`, `DELETE …/:clave` para descartar).
- **Límites** en memoria por cuenta: 5 alertas y 5 sugerencias cada 10 minutos y 30 mensajes de chat; luego 429 con `reintentarEn`.
- **Revisión** (panel): `GET /api/admin/participacion/{alertas|sugerencias}?estado=&pagina=` (`participacion.ver`: analista, coadmin y admin) devuelve 20 por página con autor y el conteo por estado. `PATCH /api/admin/participacion/{alertas|sugerencias}/:id/estado` (`participacion.gestionar`: coadmin y admin), cuerpo `{ estado, estadoAnterior }`: `recibida`, `en_revision` o `atendida`; si otra persona lo cambió responde 409, repetir es idempotente y cada cambio queda en `tb_auditoria`.
## Pruebas

Configurar `TEST_DATABASE_URL` apuntando exclusivamente a una base PostgreSQL **desechable** y correr `bun run check` y `bun run test` desde `backend/` (el script da 20 s por prueba: cada intento de acceso calcula un hash Argon2id, lento a propósito). Las pruebas de API aplican las migraciones y borran sus filas iniciales; no apuntarlas a una base con datos reales. SMTP y Google se sustituyen por dobles de prueba. La entrega SMTP real y el acceso con un ID token real requieren la configuración externa anterior.

Las reglas locales para Codex y Claude están en `AGENTS.md` y `CLAUDE.md` en la raíz y están ignoradas por Git.

## Despliegue

Todo lo de producción (VPS con Docker detrás de Cloudflare: PostgreSQL, backend, publicador y nginx) está en [`server-produccion/`](../server-produccion/README.md). Para probar en otra PC con Windows, [`server-local/`](../server-local/README.md).

La imagen del backend (`Dockerfile`) verifica los tipos y ejecuta las pruebas que no necesitan base antes de construirse. Las migraciones no se aplican solas: el README de producción indica cuándo ejecutar `bun run db:migrate`.
