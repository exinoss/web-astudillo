# Pasos para cerrar la auditoría de arquitectura

Guía resumida de [auditoria-arquitectura.md](auditoria-arquitectura.md). Cada paso cita su hallazgo (H1…H12) o sección; si algo no está aquí, no lo pide la auditoría. Ante cualquier duda manda el documento oficial.

Reglas que valen para todos los pasos (§5):

- Un hallazgo por cambio. No mezclar SQL, carpetas y CSS en el mismo PR.
- Sin migraciones de datos, sin Redis/broker, sin frameworks nuevos ni carpetas `utils`.
- Antes de mover algo, buscar sus referencias en código, pruebas, scripts, Dockerfiles y guías.
- Verificación mínima de cada paso: `bun run check` y `bun run test` en `backend/`; `bun run check`, `bun run build` y `bunx playwright test` en `frontend/`.

## Etapa 1 — Corregir los dos defectos demostrados (P1)

Checklist (auditoría §4 H1, §4 H2 y §5 etapa 1):

- [x] **H1** · `fn_suggestion_by_key` (hoy en `backend/database/funciones/participacion.sql`) y `suggestionByKey` en `db/call.ts`, igual que `fn_alert_by_key`.
- [x] **H1** · `createSuggestion` busca la clave antes de `limit()`; los reintentos simultáneos de una misma clave comparten una sola petición en curso, así que consumen una única unidad.
- [x] **H1 · base local** · `bun run db:migrate` aplicado en la base local; `fn_suggestion_by_key` existe. En producción lo aplica el despliegue (`migrar` en `server-produccion/compose.yml`).
- [x] **H1** · Prueba `los reintentos de una sugerencia no gastan el límite de envíos, tampoco a la vez` en `backend/tests/participation.test.ts`. Con el código anterior falla (429 en lugar de 200).
- [x] **H2** · `vigilarCambios` y `bloquearMientras` (`frontend/src/lib/cuenta/panel/cambios.ts`): un único estado pendiente por formulario, asociado a su `id` para que redibujarlo no habilite el botón nuevo. `busy` (`ui.ts`) lo usa e ignora los clics que llegan mientras la petición sigue en curso.
- [x] **H2** · Pruebas en `frontend/tests/panel.spec.ts`: respuesta lenta + escritura + Enter/doble clic/redibujado = una sola PUT; un error permite reintentar; el 409 conserva lo escrito; un guardado correcto deja Guardar deshabilitado. También se prueba en biografía, obras y páginas de presentación. Con el código anterior falla.

### Paso 1 · H1: los reintentos de sugerencia no deben gastar cupo

Archivo: `backend/src/participation/services/participation.ts` (`createSuggestion`).

1. Antes de llamar a `limit(...)`, buscar si ya existe una sugerencia de ese usuario con esa `idempotencia`. Si existe, devolverla sin consumir cupo.
2. Mantener autorización, consentimiento y la unicidad SQL (`uq_sugerencias_idempotencia`).
3. Asegurar que dos reintentos **simultáneos** de la misma clave tampoco consuman dos unidades (la consulta previa sola no lo garantiza; coordinar esa clave en el limitador actual si hace falta).
4. **No** mover simplemente `limit()` después del INSERT: se guardaría el envío y respondería 429.
5. Pruebas nuevas en `backend/tests/participation.test.ts`:
   - misma clave enviada más de 5 veces → siempre 200 y una sola fila;
   - reintentos concurrentes de la misma clave;
   - clave ya existente con el cupo agotado → 200;
   - claves nuevas siguen limitadas (429 al pasar de 5);
   - el cupo es independiente por usuario;
   - sin permiso o sin consentimiento → rechazo.

### Paso 2 · H2: Guardar no se habilita mientras la petición está en curso

Archivos: `frontend/src/lib/cuenta/panel/cambios.ts` (`vigilarCambios`) y `frontend/src/scripts/cuenta/panel/ui.ts` (`busy`).

1. Un único estado `pendiente` por formulario/acción.
2. Guarda de reentrada en `busy`: si ya hay una petición en curso, no lanzar otra.
3. La habilitación del botón combina «hay cambios» **y** «no hay petición pendiente».
4. Al terminar, recalcular el estado contra la base vigente. No dejar el botón habilitado sin condición en el `finally`.
5. Ante 409: conservar lo escrito y mostrar el conflicto.
6. Aplicar el mismo mecanismo en todos los formularios que usan esas funciones: propuestas, biografía, obras y páginas de presentación.
7. Pruebas Playwright: respuesta lenta + editar + doble clic/Enter = una sola petición; un error permite reintentar; un guardado correcto sin cambios deja Guardar deshabilitado; el 409 conserva los valores.

## Etapa 2 — Documentación y CI (P2)

Checklist (auditoría §4 H3, §4 H10, §6 y §5 etapa 2):

- [x] **H3** · `como-funciona-la-publicacion.md`: tres repositorios con `SnapshotRepository`, sin fallback 404, la semilla crea la primera publicación, el fallo explícito deja `dist` intacto, un solo publicador y ninguna transacción entre la base y los archivos (§5.3). Se añaden los `_astro` que se conservan (§5.2) y la vista previa (§5.4).
- [x] **H10** · `bun run test:unit` en `.github/workflows/despliegue.yml`, antes de Playwright. Probado en local y con Node 22 (la versión del runner) en un contenedor temporal: 2/2.
- [x] **§6 · borrar** `plan-kpis.md`.
- [x] **§6 · consolidar y borrar** `aviso-legal-borrador.md` y `terminos-condiciones-borrador.md`: los textos ya estaban en las páginas Astro; los fundamentos exclusivos pasan a `plan-previo-publicacion.md` §5, con fecha, y se corrige su enlace.
- [x] **§6 · consolidar y borrar** `integraciones-pendientes.md`: redirecciones GET al `backend/README.md`; ciudadanía y modelos fijos al `frontend/README.md` y a `plan-modelos-3d.md`; se actualizan los dos enlaces de los README.
- [x] **§6 · consolidar y borrar** `plan-limite-intentos.md`: los motivos y la IP real pasan al `backend/README.md` (el comportamiento vigente ya estaba) y la interacción del candado al `frontend/README.md`.
- [x] **§6 · actualizar** `plan-modelos-3d.md` (cifras iniciales marcadas como históricas, medición actual), `plan-vista-previa.md` (secciones 1–5 marcadas como propuesta; vale la 6), `plan-paginas-carlos.md` (la garantía de fotos de §8.3 se ajusta al servicio y al SQL reales), `politica-privacidad-borrador.md` (introducción posterior al despliegue) y `solicitud-imagen-redes.md` (imagen provisional actual de 1200×630).
- [x] **§6 · opcional** · `CHANGELOG.md`: el descarte de la franja de cifras en la portada y los documentos retirados, en «Removed»; los fallos de H1, H2 y H11, en «Fixed».
- [ ] **§6 · condicional** · borrar `solicitud-imagen-redes.md` cuando llegue y se apruebe la pieza definitiva.

### Paso 3 · H3: actualizar `como-funciona-la-publicacion.md`

1. Sección 6.1: el selector `frontend/src/lib/data/index.ts` elige entre **tres** repositorios (HTTP, mock en `--mode test` y archivo con `CONTENIDO_ARCHIVO` para la vista previa).
2. Quitar el fallback «404 → semilla»: `HttpContentRepository` lanza un error si la API no responde bien.
3. Documentar la semilla inicial y el fallo explícito cuando la API no está disponible.
4. Dejar escrito que solo debe haber **un publicador** (las rutas `dist-nueva`, `dist-anterior` y el archivo de vista previa son compartidas).
5. No cambiar código para que encaje con el documento antiguo.

### Paso 4 · §6: depurar `docs/`

Ver la sección «Documentos de `docs/`» al final de esta guía.

### Paso 5 · H10: pruebas unitarias del frontend en CI

En `.github/workflows/despliegue.yml`, añadir `- run: bun run test:unit` antes de `bunx playwright test`, en el mismo directorio de trabajo `frontend`. Comprobar que funciona con el Node del runner (el script usa `node --test` sobre un `.ts`). No tocar las condiciones ni los comandos de despliegue.

## Etapa 3 — Orden interno pequeño (P2), en este orden

Checklist (auditoría §4 H4–H7 y §5 etapa 3):

- [x] **H4** · `CONTENT_CONFLICT` en `backend/src/content/conflictos.ts`; `about-carlos.ts` ya no importa `content.ts` y el ciclo desaparece.
- [x] **H4** · `plainText` (con sus constantes) en `backend/src/validation/texto.ts`, sin cambios; se actualizan sus 9 importadores, incluida `tests/validation.test.ts`. `linkValue`, `sitePath` y `year` siguen en `content`.
- [x] **H5** · `passwordProblem` en `backend/src/contracts/password.ts`. `password-policy.ts` (API) y `lib/cuenta/auth/password.ts` (formularios) conservan sus mensajes y la confirmación. Requisitos sin cambios; la prueba de paridad sigue pasando.
- [x] **H6** · `Photo extends UploadedPicture`, `DraftAboutCarlosPage = ApiAboutCarlosPage<Photo>` y `AboutCarlosSlug` reutilizado de `types.ts`, todo con `import type`. No se unifican modelos de vista.
- [x] **H6** · `backend/src/contracts/media.ts` con `CARD_SIZE` y `cardVariantFile`: lo usan `content/services/media.ts` y `frontend/src/lib/comun/fotos.ts`, sin repetir el nombre `-tarjeta-760.webp`. El nombre resultante no cambia, así que no se renombran los medios ya subidos.
- [x] **H7** · Ubicación sin cambios. Se documenta en `frontend/README.md` que el frontend compila con `backend/` al lado y que solo importa módulos puros (se comprobó que los contratos no importan nada).
- [x] Verificación: `bun run check` en los dos lados; backend 107/107; frontend `build` (28 páginas), `test:unit` 2/2 y Playwright 112/112; pruebas del panel y de cuenta también en el servidor de desarrollo. No cambia el empaquetado: las dos imágenes ya copian `src` completo, así que no se reconstruyeron.

### Paso 6 · H4: romper el ciclo `content.ts` ↔ `about-carlos.ts`

1. Mover `CONTENT_CONFLICT` a `backend/src/content/conflictos.ts` e importarlo desde `content.ts` y `about-carlos.ts`.
2. Mover `plainText` a `backend/src/validation/texto.ts`, sin cambiar su comportamiento. Las validaciones editoriales (`linkValue`, `sitePath`, `year`…) se quedan en `content/services/validation.ts`.
3. Actualizar **todos** los importadores. Hoy son, además de `content`: `auth/services/registration.ts`, `auth/services/google.ts`, `cli/admin.ts`, `participation/services/participation.ts`, `participation/services/chat.ts` y `profile/services/profile.ts`.
4. Comprobar: mismos mensajes de error y mismos valores normalizados.

### Paso 7 · H5: una sola regla de contraseña

1. Crear `backend/src/contracts/password.ts` con una función pura que devuelva el resultado de la validación (longitud 6–128, letra, número, símbolo, sin secuencias de 4).
2. `backend/src/auth/password-policy.ts` y `frontend/src/lib/cuenta/auth/password.ts` la usan y conservan sus propios errores, mensajes y la confirmación.
3. No cambiar los requisitos de la contraseña.
4. Comprobar: los casos de `password-policy.test.ts`, el login con contraseñas existentes y el build del frontend.

### Paso 8 · H6: tipos de foto repetidos en el frontend

1. Reutilizar con `import type` los tipos equivalentes del frontend (`UploadedPicture` en `lib/data/types.ts`, `Photo` en `http/admin-api.ts` y los de `data/acerca-de-carlos.ts`). No unificar modelos de vista que sean distintos.
2. Solo si se vuelve a tocar el formato de las fotos: llevar el nombre `-tarjeta-760.webp` a una función pura en `backend/src/contracts/media.ts`. Nunca importar Sharp en el navegador ni renombrar medios ya subidos.

### H7 · Contratos compartidos: no se mueven

`backend/src/contracts` se queda donde está mientras frontend y backend se entreguen juntos. Solo documentar que el frontend compila con el árbol del backend presente y que esos imports cruzados deben ser módulos puros. No crear un paquete `shared/` (la carpeta actual está vacía).

## Etapa 4 — Aplazables (P3): solo cuando un cambio funcional lo justifique

Checklist (auditoría §4 H8, H9, H11, H12 y §5 etapa 4: «solo al justificarse», un módulo a la vez):

H11 se hizo porque su prueba falló. H6, H8, H9 y H12 se hicieron después, a petición expresa, un módulo a la vez y con las comprobaciones que pide cada hallazgo.

- [x] **H11** · Prueba determinista en `backend/tests/content.test.ts`: después de leer los textos guarda un texto y luego una propuesta. Con el código anterior **falló**: la publicación tenía la propuesta pero no el texto. Como falló el contrato, se aplicó la corrección prevista: `snapshot()` lee en una transacción `REPEATABLE READ READ ONLY`. Pasan publicación, vista previa y conflictos (suite completa).
- [x] **H8** · `database/fn.sql` pasa a `database/funciones/{auth,perfil,admin,contenido,publicacion,estadisticas,participacion}.sql`, con una lista explícita y ordenada en `db/migrate.ts`, la misma transacción y las mismas firmas. `fn.sql` se borra: no hay definiciones duplicadas. Solo se retiraron las 4 líneas separadoras y la cabecera, que pasa a `migrate.ts`; el resto de líneas se comprobó una a una. Una instalación vacía, la actualización de una base creada con el `fn.sql` anterior y la migración repetida dan las mismas 99 funciones, definiciones (`pg_get_functiondef`), permisos y datos de semilla que antes. También migra desde la imagen Docker de la API. `drizzle/`, semilla y privilegios sin cambios.
- [x] **H9 · CSS** · Las 3 reglas de `styles/forms.css` pasan a utilidades en `Alerta.astro`, `Sugerencia.astro` y `Chat.astro`, y el archivo se elimina. 189 capturas por versión (3 páginas × 320/390/759/760/761/768/1440 × normal y 8 modos) idénticas píxel a píxel antes y después, sin desbordes. Las capturas detectaron que `mt-5` (1,25rem) mide 25 px con el texto al 125 %; se usó `mt-[20px]`, igual que la regla original.
- [x] **H9 · nombres y comentarios** · Archivos nuevos con nombres funcionales (`conflictos.ts`, `validation/texto.ts`, `contracts/password.ts`, `contracts/media.ts`, `database/funciones/*.sql`); se revisaron los comentarios de todas las líneas modificadas.
- [x] **H12** · Firmas explícitas en `callPg` para `alertByKey`, `alertCreate`, `suggestionByKey` y `suggestionCreate` (las modificadas y las de muchos parámetros posicionales). El resto sigue con `unknown[]`. Se comprobó que una llamada con los parámetros desordenados ya no compila.

- **Paso 9 · H8:** dividir `backend/database/fn.sql` en `backend/database/funciones/{auth,admin,perfil,contenido,participacion,estadisticas,publicacion}.sql`, listados en orden en `db/migrate.ts`, con la misma transacción y las mismas firmas. Sin `\i` de psql y sin dejar funciones duplicadas entre el archivo viejo y los nuevos. Nunca borrar migraciones de `drizzle/`.
- **Paso 10 · H9:** al tocar cada módulo, pasar a utilidades las reglas estáticas de `styles/forms.css`, usar nombres funcionales en los archivos nuevos y quitar comentarios redundantes en las líneas modificadas. Capturas antes/después idénticas en 320/390/768/1440 y en los límites del breakpoint (759/760/761), con los 8 modos de accesibilidad.
- **Paso 11 · H11:** primero, una prueba que intercale escrituras mientras `snapshot()` lee con `Promise.all`. Solo si falla, leer contenido y versiones dentro de una transacción coherente o de una función SQL.
- **Paso 12 · H12:** añadir firmas tipadas a `callPg` solo en las operaciones que se modifiquen o que sean propensas a errores. Sin generadores de repositorios.

## Documentos de `docs/`

Según §6 de la auditoría.

### Borrados

| Documento | Motivo |
| --- | --- |
| `plan-kpis.md` | Era el único eliminable directamente: el plan estaba marcado como «sustituido», no tenía referencias entrantes y los KPI viven en la semilla, el panel y `KpiStrip.astro`. |
| `aviso-legal-borrador.md` | Texto ya en `pages/aviso-legal.astro` y `LegalContact.astro`; fundamentos en `plan-previo-publicacion.md` §5. |
| `terminos-condiciones-borrador.md` | Texto ya en `pages/terminos-y-condiciones.astro`; decisiones con fecha en `plan-previo-publicacion.md` §5. |
| `integraciones-pendientes.md` | Redirecciones en `backend/README.md`; lo fijo en el código en `frontend/README.md` y `plan-modelos-3d.md`. |
| `plan-limite-intentos.md` | Comportamiento y motivos en `backend/README.md`; interacción en `frontend/README.md`. |

### Pendiente de borrar con condición

| Documento | Cuándo |
| --- | --- |
| `solicitud-imagen-redes.md` | Cuando se reciba y apruebe la pieza definitiva: guardar requisitos y aprobación en el registro y cerrar el pendiente. |

### Actualizados (no borrar)

`como-funciona-la-publicacion.md`, `plan-modelos-3d.md`, `plan-paginas-carlos.md`, `plan-vista-previa.md`, `politica-privacidad-borrador.md` y `solicitud-imagen-redes.md`.

### Conservar

`auditoria-secretos-git.md`, `guia-despliegue-hostinger.md` y `guia.md` (locales, fuera de Git), `plan-previo-publicacion.md`, `revision-privacidad-local.md`, `verificacion-cierre-local.md` y `auditoria-arquitectura.md`.
