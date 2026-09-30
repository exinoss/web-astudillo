# Plan — Límite de intentos progresivo (OWASP), candado con cronómetro y correos con la marca

**Estado (2026-09-30): implementado.** Queda pendiente solo lo de despliegue (`limit_req` en nginx e IP real detrás de Vercel; ver `backend/README.md`).

## Contexto

El límite actual (`backend/src/auth/services/limits.ts`) es una ventana fija en memoria: cuenta *todos* los intentos, se borra al reiniciar, no dice cuánto esperar y tiene tres huecos:
1. **Fuerza bruta con correos al azar**: el límite por correo nunca salta y cada intento cuesta un hash Argon2id (también con correos inexistentes, a propósito), así que se puede saturar la CPU.
2. **Atajo**: un acceso correcto reinicia el contador de la IP (`sessions.ts`, `google.ts`), así que un atacante con una cuenta propia se salta el límite por IP.
3. **Sabotaje**: el límite por correo permite dejar fuera al dueño escribiendo mal su contraseña.

Además, el usuario pide:
- quitar la contraseña que se exige al abrir el enlace de registro desde otro navegador;
- que todos los correos sean HTML con la marca y un botón, en vez de una URL suelta, y que digan «Si usted no solicitó este correo, por favor ignórelo».

Decisiones del usuario: escalada «5 libres, luego sube»; el ataque repartido contra un correo pide un **enlace por correo**; la parte visual (candado y correos) se aprueba antes con una **maqueta en `design/`**. Orden: primero local; lo de nginx y Vercel queda anotado para el despliegue.

## 1. Límite de intentos

**Tres contadores de fallos en PostgreSQL** (sobreviven a reinicios, son atómicos):

| Clave | Frena | Escalada |
| --- | --- | --- |
| `correo+IP` | fuerza bruta contra una cuenta | 5 fallos libres → 1 min, 5 min, 15 min, 1 h, 6 h → **3 días** |
| `IP` | correos y contraseñas al azar | 20 libres → misma escalada |
| `correo` (todas las IPs) | ataque repartido | 20 fallos en 24 h → el correo pasa a **pedir enlace por correo** |

**Reglas**
- Solo cuentan los **fallos**. Un intento hecho mientras hay bloqueo se rechaza antes del hash y **no suma**: el atacante no puede inflar los contadores.
- Si pasan 24 h sin fallar, el contador vuelve a cero, así que tras los 3 días se puede volver a intentar.
- Un acierto limpia **solo** su pareja `correo+IP`: el atacante sigue bloqueado. El contador de IP ya no se reinicia con un acierto, lo que cierra el hueco 2.
- **Restablecer la contraseña por el enlace del correo limpia todos los contadores de ese correo**: el dueño demuestra que controla el correo. Así también sale si comparte IP con el atacante (misma wifi o, hoy, detrás de Vercel).
- **Correo en modo enlace**: cualquier intento con ese correo recibe la misma respuesta, «Por seguridad te enviamos un enlace a tu correo para terminar de entrar». El enlace **solo se envía si la contraseña era correcta**; el atacante no aprende nada y el dueño entra con un clic desde su bandeja. El enlace es de un solo uso, dura 15 min y no está atado al navegador, igual que el de recuperación. Completarlo limpia el contador del correo.
- **Protección de la CPU**: se comprueban los bloqueos (una consulta barata) **antes** del hash, y hay un tope de 8 hashes simultáneos. Si está lleno, responde 503 «inténtalo en unos segundos».
- El **429** lleva `Retry-After` y `{ error, reintentarEn }`, con un mensaje genérico que no dice qué clave se bloqueó. En el **primer bloqueo (1 min) del inicio de sesión** añade `sugerirRecuperacion: true` y el formulario muestra «¿Olvidaste tu contraseña? Puedes restablecerla ahora», con enlace a `/cuenta/recuperar/` y el correo ya escrito. Aparece igual con correos inventados, así que no revela si la cuenta existe.
- **Dónde se aplica**:
  - sanción progresiva en el inicio de sesión y en el cambio de contraseña (actual incorrecta);
  - registro, recuperación y Google conservan su límite por cantidad (en memoria), pero también devuelven `reintentarEn` para mostrar el cronómetro.

**Actualización (2026-09-30):** a petición del usuario, solo el tope (3 días, «bloqueo mortal») se trata como ataque. Esa IP queda bloqueada para cualquier correo, y el modo enlace se activa cuando **2 o más IPs** llegan al bloqueo mortal con el mismo correo. Esto sustituye al contador `correo:` de 20 fallos. Las esperas previas son solo para la pareja correo+IP.

**Caso del dueño** (pregunta del usuario): el atacante (IP A) está bloqueado 5 min. El dueño (IP B) falla 5 veces, que siguen siendo libres; al sexto espera 1 min, y con la contraseña correcta **entra**. Solo su pareja `correo+B` se limpia; el atacante sigue bloqueado. No hace falta el enlace: el atacante sumó unos 6 o 7 fallos (los intentos bloqueados no cuentan) y el dueño 6, lejos de los 20. El enlace solo aparece si muchas IPs atacan el mismo correo, y aun así el dueño entra con un clic desde su correo.

## 2. Registro sin la contraseña en otro navegador
- Se quita la cookie `registration` y la comprobación de navegador o contraseña en `verify`: el enlace de registro funciona en cualquier navegador.
  - `backend/src/auth/services/registration.ts` y `routes/registration.ts`.
  - La columna `verificador_navegador_hash` queda sin usar para el registro; no se toca el esquema por esto.
  - `frontend/src/scripts/account-verify.ts` y `pages/cuenta/verificar.astro`: fuera el formulario de contraseña.
- **Riesgo aceptado**: alguien podría registrar el correo de otra persona con su propia contraseña y esperar a que la víctima pulse el enlace. Lo mitiga el texto del correo, y el dueño siempre puede recuperar la cuenta con «Olvidé mi contraseña».
- **Actualización (2026-09-30):** se simplificó el acceso con Google. Solo acepta correos de Gmail o Google Workspace; una cuenta de Google hecha con otro correo recibe «Entra con tu correo y contraseña». Desaparecen la confirmación por correo de Google, su página y su plantilla (migración `0005_google_solo_gmail`).

## 3. Correos HTML con la marca
- **Una plantilla** para los tres correos: verificar registro, recuperar contraseña y el nuevo acceso por enlace. Cada uno cambia el asunto, el título, el texto, la etiqueta del botón y la vigencia.
- **Diseño**, coherente con el sitio y con tablas y estilos en línea, porque es lo que respetan los clientes de correo:
  - 600 px de ancho y adaptable a móvil;
  - cabecera amarilla `#F9C31B` con el logo;
  - la foto de `carlos_back2.png` recortada para la cabecera;
  - tarjeta blanca con el título en azul `#063176`, en Barlow Condensed con respaldo `'Arial Narrow', Arial`, y el texto en DM Sans con respaldo Arial;
  - **botón** azul del sitio de al menos 48 px de alto;
  - debajo, en pequeño, «Si el botón no funciona, copia este enlace» (hace falta para accesibilidad y algunos clientes);
  - pie con `#lanuevahistoria` (`nuevahistoria.png`), «Si usted no solicitó este correo, por favor ignórelo.» y «Partido Social Cristiano · Lista 6 · San Lorenzo».
  - Todas las imágenes con `alt` descriptivo; se lee bien aunque el cliente bloquee las imágenes.
- **Imágenes incrustadas (CID)**, no enlazadas: en local `APP_ORIGIN` es localhost y un correo real no las cargaría.
  - Hay que convertir versiones: el logo AVIF a PNG, la foto a JPG de 600 px (unos 50 KB) y el hashtag optimizado.
  - Por la regla del material del cliente, las versiones convertidas van primero a `design/propuestas/correo/` y, tras la aprobación, se copian a `backend/assets/correo/`. Los originales no se tocan.
- También lleva **parte de texto plano** con el mismo contenido, para clientes sin HTML.
- **Código**: `backend/src/mailer.ts` pasa de `send(to, subject, url)` a `send(to, mensaje)`, con `mensaje = { asunto, titulo, texto, boton, url, vigencia }`; la plantilla va en `backend/src/mail/plantilla.ts`. El `Dockerfile` copia `backend/assets/`.

## 4. Candado y botón gris (frontend, tras aprobar la maqueta)
- **Maqueta** `design/propuestas/cuenta/limite-intentos.html` (junto con la de los correos):
  - el formulario de acceso actual con el botón deshabilitado en gris;
  - un candado SVG que se cierra (el arco baja, con un rebote corto);
  - el cronómetro «Podrás intentarlo de nuevo en 04:32» o «en 2 días 23 h»;
  - la sugerencia de restablecer la contraseña en el primer bloqueo;
  - el aviso del enlace por correo;
  - la versión quieta con Reducir movimiento;
  - capturas a 320, 390, 768 y 1440 px.
- **Implementación**:
  - `ApiError.retryAfter` en `frontend/src/lib/data/http/api-client.ts`;
  - el componente `components/account/Candado.astro` (SVG en línea);
  - `lib/auth/bloqueo.ts`, que desactiva el botón, lleva la cuenta atrás, lo reactiva al terminar y respeta la clase `reduce-motion`;
  - los keyframes en `@theme` (`--animate-candado`), como `rebote` en `global.css`;
  - se aplica en acceso, cambio de contraseña, registro y recuperación, a través de `showStatus` en `lib/auth/page.ts`.
- **Página nueva** `pages/cuenta/acceso.astro` y su script, para el enlace de acceso, copiando `verificar.astro`; más `confirmLogin(token)` en los repositorios de autenticación.

## Backend: archivos
- **Esquema** (`src/db/schema.ts` → `bun run db:generate`, migración `0004_limite_intentos`):
  - `tb_limites_intentos(clave PK, fallos, bloqueado_hasta, ultimo_fallo)`;
  - nueva finalidad `acceso_correo` en los CHECK de `tb_token_autenticacion`.
- **`database/fn.sql`**:
  - `fn_limit_check(claves text[])`;
  - `fn_limit_fail(clave, libres)`: upsert atómico con la escalada y el reinicio a las 24 h; borra filas de más de 4 días;
  - `fn_limit_clear(clave)` y `fn_limit_clear_email(correo)`, esta al restablecer;
  - el enlace de acceso reutiliza `fn_auth_token_create`, que ya es idempotente.
- **`src/auth/services/limits.ts`**: `createAttempts(sql)` y el semáforo `hashSlot()`; el limitador en memoria se queda, ahora con `reintentarEn`.
- **Servicios**: `passwords.ts` (`login`, `change`, `reset` limpia contadores) y `registration.ts` (sin la comprobación de navegador).
- **Rutas**:
  - `sessions.ts` y `google.ts` dejan de limpiar la IP;
  - nuevo `POST /api/auth/login/confirm`, con su `GET` de redirección, siguiendo el patrón de `/verify-email`.
- **Errores**: `retryAfter` en `ApiError` → cabecera `Retry-After` en `src/http-errors.ts`.
- **Registro de funciones**: `src/db/call.ts` y `migrate.ts`.

## Documentación
- `backend/README.md`:
  - la tabla de límites y la escalada;
  - el flujo de registro sin navegador;
  - los correos HTML;
  - **«Pendiente para el despliegue»**: `limit_req` en `nginx.conf`, y la **IP real detrás de Vercel**. Hoy el backend ve la IP de Vercel, así que el contador por IP y la pareja correo+IP agruparían visitantes; hay que resolverlo antes de desplegar ahí. En el servidor propio del cliente con nginx directo funciona tal cual.
- `CHANGELOG.md`.
- `docs/integraciones-pendientes.md`: quitar la nota de «límites en memoria» para los accesos.

## Verificación
- **`bun test` (base desechable)**, archivo nuevo `tests/limits.test.ts` con `trustProxyIp: true` y `x-real-ip`:
  - la escalada 60 s → … → 3 días, ajustando las fechas por SQL;
  - el caso del dueño: el atacante sigue bloqueado y el dueño entra desde otra IP;
  - un acierto no limpia la IP;
  - los intentos bloqueados no suman;
  - 25 correos al azar desde una IP → 429;
  - modo enlace: misma respuesta con contraseña buena o mala y correo solo con la buena; el enlace se usa una vez y limpia el contador;
  - restablecer limpia los contadores;
  - `Retry-After` y `sugerirRecuperacion`;
  - reinicio a las 24 h;
  - 5 fallos simultáneos suman exactamente 5.
- **Pruebas existentes**:
  - `auth.test.ts`: el registro verifica sin cookie ni contraseña;
  - el doble de correo de las pruebas se adapta a `send(to, mensaje)`, comprobando que el HTML trae el botón con la URL, el texto de «ignórelo» y las imágenes CID.
- **Playwright** con la API simulada:
  - 429 → botón gris, candado, cronómetro que baja y reactiva el botón;
  - en el primer bloqueo, el enlace a recuperar con el correo ya escrito;
  - con Reducir movimiento, candado quieto;
  - sin desbordes de 320 a 1440 px;
  - `/cuenta/acceso/`;
  - verificar registro sin formulario de contraseña.
- **Correos reales en local con Mailpit** (`bun run mailpit`, ya existe en `backend/scripts/mailpit.ts`): se envían los cuatro correos y se revisan en su bandeja web en escritorio y a 390 px, más una prueba con imágenes bloqueadas.
- `bun run check` en los dos lados, `bun run build`, `bun run db:migrate` en la base de desarrollo y prueba manual: 6 fallos seguidos en `localhost:4321` → candado y cronómetro.
