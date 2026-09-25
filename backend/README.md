# Backend — Carlos Astudillo

API de autenticación y perfil en Bun, Elysia y PostgreSQL. El cliente HTTP de Astro apunta a estas rutas bajo `/api` en el mismo origen. Las tablas de contenido y participación ciudadana se añadirán después.

## Preparación

1. Instalar dependencias en `backend/` con `bun install`. Copiar `.env.example` a `.env` y completar: `DATABASE_URL`, `APP_ORIGIN`, `JWT_SECRET` (al menos 32 caracteres aleatorios), `GOOGLE_CLIENT_ID` y las variables `SMTP_*`. Las seis variables SMTP ya están en el `.env` local; todavía hay que comprobar que el remitente esté autorizado y que los mensajes lleguen. No publicar el archivo ni compartir sus valores.
2. Con `DATABASE_URL` apuntando a PostgreSQL, ejecutar `bun run db:migrate` desde `backend/`. Drizzle aplica las migraciones versionadas generadas desde los modelos de `src/db/schema.ts`; el comando también aplica `database/fn.sql` y `database/datains.sql`. En una base existente sin historial Drizzle, valida las tablas y columnas modeladas y registra la migración inicial como aplicada sin volver a crear las tablas. No se necesita un `bd.sql` separado.
3. Crear un cliente OAuth **web** de Google y autorizar `http://localhost:4321` para desarrollo. Copiar el mismo ID a `GOOGLE_CLIENT_ID` aquí y `PUBLIC_GOOGLE_CLIENT_ID` en Astro; un ID de ejemplo no permite acceso real.
4. Ejecutar `bun run dev` desde `backend/`. Por defecto escucha en `127.0.0.1:3000`. `APP_ORIGIN` debe ser `http://localhost:4321` en desarrollo, el origen que verá el navegador. Astro envía `/api` al backend. En producción, servir `/api` desde el mismo sitio mediante un proxy HTTPS. El proceso falla al arrancar si faltan variables obligatorias, PostgreSQL no responde o hay migraciones pendientes.

### Correo local con Mailpit

Desde WSL, iniciar `docker compose -f compose.mailpit.yml up -d` en esta carpeta. La bandeja queda en `http://localhost:8025` y SMTP en `127.0.0.1:1025`. Para cambiar entre Mailpit y SMTP de Google, activar el bloque `SMTP_*` correspondiente en tu `.env` y reiniciar el backend. Mantener un solo bloque activo; no hace falta otro archivo de variables.

## Flujos

- **Correo y contraseña:** `POST /api/auth/register` recibe `nombresCompletos`, `correo`, `contrasenia`, `confirmarContrasenia` y `direccion?`. Comprueba ambas contraseñas y guarda una solicitud temporal con hash Argon2id, sin crear ni reservar usuario. El enlace dura 30 minutos y abre Astro; esa página llama a `POST /api/auth/verify-email` usando el secreto temporal del navegador original o la contraseña de registro en otro navegador. Solo entonces crea usuario Votante e identidad de correo en una transacción. La persona inicia sesión después con `POST /api/auth/login`.
- **Google:** `POST /api/auth/google` recibe `{ credential }`, valida el ID token y busca primero el `sub`. Si el correo Gmail o Workspace coincide con un usuario verificado, vincula Google a ese mismo usuario. Para un correo externo a esos servicios, envía una confirmación adicional de 15 minutos antes de vincular o crear; la solicitud conserva el `sub` y requiere el navegador original o un nuevo ID token de esa misma cuenta Google. Una cuenta nacida con Google puede añadir contraseña mediante `POST /api/auth/password`, con sesión activa y reautenticación Google.
- **Sesiones:** las respuestas de acceso establecen cookies `access` (JWT, 10 minutos) y `refresh` (token opaco, 7 días), `HttpOnly` y `SameSite=Lax`; en producción también `Secure`. `POST /api/auth/refresh` rota el hash de renovación y extiende la expiración de la sesión otros 7 días desde cada renovación; `POST /api/auth/logout` la revoca. Una copia del JWT de acceso puede funcionar hasta que venza, incluso tras cerrar sesión. Las rutas de perfil comprueban que el usuario siga activo.
- **Recuperación:** `POST /api/auth/password/reset-request` envía un enlace de un solo uso para cuentas con identidad de correo. `POST /api/auth/password/reset` cambia el hash y revoca todas sus sesiones. Una cuenta solo Google no recibe una contraseña a través de este flujo.
- **Cambio de contraseña:** `POST /api/auth/password/change` requiere sesión, permiso `cuenta.contrasenia.cambiar`, `contraseniaActual`, `contraseniaNueva` y `confirmarContrasenia`. Comprueba la contraseña actual, actualiza el hash, revoca todas las sesiones y borra las cookies del navegador. La cuenta vuelve a iniciar sesión.
- **Perfil:** `GET /api/me` y `PATCH /api/me` requieren acceso válido. `GET` incluye `tieneContrasenia` y `tieneGoogle` para mostrar los métodos de acceso disponibles. El cambio admite solo `nombresCompletos` y `direccion?`; no admite correo, rol ni estado. No hay API pública para cambiar roles.

Las contraseñas nuevas admiten de 6 a 128 caracteres y requieren una letra, un número y un símbolo. Se aplica al registro, recuperación, alta desde Google y cambio; el acceso sigue aceptando contraseñas existentes. Es la política solicitada para este proyecto, aunque [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) recomienda un mínimo de 15 caracteres cuando la contraseña es el único factor y desaconseja las reglas de composición.

La API responde con errores genéricos en acceso y solicitudes de correo, limita intentos por IP y correo en memoria para el despliegue inicial de una instancia, comprueba el encabezado `Origin` en escrituras y no registra contraseñas ni tokens. Los JWT se validan sin consultar `tb_sesiones` en cada petición; las acciones administrativas futuras deberán consultar el rol actual en la base. Las notas sobre enlaces antiguos y funciones pendientes están en [integraciones-pendientes.md](../docs/integraciones-pendientes.md).

## Datos, migraciones y permisos

`src/db/schema.ts` es la fuente del esquema y también deriva los tipos de filas de `src/db/types.ts`. Para un cambio de tablas, modifica el modelo y ejecuta `bun run db:generate`; revisa y conserva el SQL generado en `drizzle/`, luego aplica con `bun run db:migrate`. Nunca edites una migración ya aplicada: genera una migración nueva. No hay un `bd.sql` paralelo que pueda quedar desactualizado. `drizzle-kit` compara los modelos con el snapshot previo y genera cada cambio; la integración existente a una base ya creada se adopta automáticamente una sola vez tras comprobar tablas y columnas.

Las rutas llaman a servicios, y los servicios invocan funciones PostgreSQL con `callPg()` de `src/db/call.ts`. El ejecutor acepta solo nombres de una lista interna y pasa los argumentos como parámetros. Las funciones están en `database/fn.sql`; los roles y permisos iniciales están en `database/datains.sql`. El catálogo de permisos usado por rutas y servicios está en `src/auth/permissions.ts`; el tipo `Permission` se deriva de sus valores, así no se mantiene una unión manual aparte. Al agregar un permiso, se agrega al catálogo, se define su asignación por rol en `database/datains.sql` y las rutas lo solicitan con `PERMISSIONS.*`. Las comprobaciones dentro de funciones sensibles de `fn.sql` repiten el permiso de esa operación para validar el acceso también en la capa de PostgreSQL.

Visitante es anónimo y no tiene acceso al perfil. `perfil.ver`, `perfil.editar`, `cuenta.contrasenia.agregar` y `cuenta.contrasenia.cambiar` se asignan inicialmente a Votante, Analista, Coadmin y Admin porque son las únicas capacidades autenticadas implementadas. La autorización consulta el rol, estado y permiso actuales en PostgreSQL: sin sesión responde 401 y sin permiso responde 403. Las futuras funciones del sitio deberán definir nuevos permisos y asociarlos a sus rutas; no hay un endpoint público para asignarlos.

## Pruebas

Configurar `TEST_DATABASE_URL` apuntando exclusivamente a una base PostgreSQL **desechable** y correr `bun run check` y `bun test` desde `backend/`. Las pruebas de API aplican las migraciones y borran sus filas iniciales; no apuntarlas a una base con datos reales. SMTP y Google se sustituyen por dobles de prueba. La entrega SMTP real y el acceso con un ID token real requieren la configuración externa anterior.

Las reglas locales para Codex y Claude están en `AGENTS.md` y `CLAUDE.md` en la raíz y están ignoradas por Git.

## Despliegue

Los archivos `Dockerfile`, `docker-compose.yml`, `nginx.conf` y `Jenkinsfile`
están en `backend/`. Se conserva un único `.env.example`; el `.env` real no
se incluye en Git ni en la imagen Docker.

1. En Jenkins, configurar **Pipeline from SCM** con Script Path
   `backend/Jenkinsfile`. El checkout conserva el repositorio completo; el
   pipeline ejecuta los comandos dentro de `backend/`.
2. Crear la credencial **Secret file** `astudillo-backend-env` con tu `.env`
   de producción. Jenkins copia ese archivo a `backend/.env` durante el job y
   elimina la copia al terminar, igual que en tu otro proyecto.
   Usar `DATABASE_URL` accesible desde Docker, `APP_ORIGIN` con el origen HTTPS
   del frontend, el ID real de Google y el bloque SMTP de producción.
   `localhost` en el contenedor no apunta a PostgreSQL ni Mailpit del host.
3. Ejecutar el job en el Docker del servidor del ejemplo. Compose utiliza el
   volumen externo `nginxfiles` en lectura y publica **9617:443**. Nginx usa
   `ssl/__uteq_edu_ec2026Enero_cert_out.pem` y `ssl/__uteq_edu_ec.key` dentro
   de ese volumen, para `aplicaciones.uteq.edu.ec`.

La construcción verifica los tipos con TypeScript y ejecuta `bun test tests/proxy.test.ts`;
si fallan, no se construye la imagen del backend. Jenkins despliega y espera
el healthcheck, luego verifica Nginx y `/api/health` por HTTPS interno. Las
pruebas completas de autenticación se ejecutan aparte como se describe en
**Pruebas**, con una base desechable. El pipeline no crea bases ni ejecuta
migraciones de producción: usa la base que ya migraste.

Comprobar externamente `https://aplicaciones.uteq.edu.ec:9617/api/health` para
validar también el dominio y el certificado; la comprobación HTTPS interna
omite esa validación porque usa la dirección loopback.

Al publicar Astro en Vercel, configurar la reescritura de `/api/:path*` hacia
`https://aplicaciones.uteq.edu.ec:9617/api/:path*` y el mismo ID Google en
`PUBLIC_GOOGLE_CLIENT_ID`. Los enlaces de correo usan `APP_ORIGIN`, por lo
que el flujo completo requiere el frontend publicado en ese origen.

Los límites por IP detrás de Vercel pueden agrupar visitantes por la IP de
salida del proxy. La identificación individual requiere configurar una
cadena de proxies confiable antes de depender de ese límite por visitante.
