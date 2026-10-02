# Plan previo a la publicación: pendientes acordados

Actualizado el **2 de octubre de 2026**, a partir de la revisión del backend, frontend, funciones SQL y configuración de producción del **1 de octubre de 2026**, y de las decisiones posteriores del usuario.

Las tablas incluyen únicamente tareas pendientes. Se excluyeron las completadas, opcionales y no aplicables; los puntos repetidos se agruparon. Los números corresponden a la lista original y los identificadores A1–A8 a hallazgos adicionales de la revisión.

**Hecho** y **Hacer** admiten únicamente **Sí** o **No**. Todas las filas pendientes tienen **Hecho: No** y **Hacer: Sí**: esto puede significar implementar, completar o verificar. **P0** indica trabajo necesario antes de recoger datos reales; **P1**, antes de anunciar el sitio.

Actualmente no hay acceso al VPS ni al dominio. La primera tabla reúne **13 pendientes que pueden trabajarse ahora**; algunos solo podrán cerrarse cuando se reciban datos o aprobaciones del responsable. La segunda contiene **13 pendientes reservados para la infraestructura**. Las preguntas de cada punto de esa segunda tabla se harán cuando haya acceso.

## 1. Pendientes que pueden trabajarse ahora

| ID | Tema | Qué es | Hecho | Hacer | Prioridad | Alcance acordado y criterio de cierre |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | Dependencias con avisos de seguridad | Revisar y corregir fallos conocidos de las bibliotecas usadas. | No | Sí | P0 | Actualizar solo las bibliotecas afectadas y las dependencias necesarias para corregir sus avisos, conservando el comportamiento. Revisar aplicabilidad, repetir el escaneo y las pruebas afectadas. El escaneo del 1 de octubre encontró 14 avisos en backend; frontend no reportó avisos. |
| 21, 51 | Aviso legal y términos y condiciones | Identificar al responsable del sitio y explicar las reglas para usar cuentas y participar. | No | Sí | P0 | Preparar **dos documentos y páginas separados**: identificación y contacto del titular; términos de uso, participación y moderación. Redactar borradores ahora. Completar los datos reales del responsable y aprobar su presentación antes de publicarlos. |
| 22, 49 | Política de privacidad | Explicar qué datos se recogen, para qué, quién los usa y qué derechos tiene la persona. | No | Sí | P0 | Preparar el borrador ahora conforme al tratamiento real: cuentas, direcciones, alertas y fotos, sugerencias, consultas guardadas del chat y proveedores. El nombre, dirección, teléfono y correo del responsable se completarán después. Publicar cuando se hayan definido también finalidades, bases jurídicas, destinatarios, conservación y derechos. |
| 23 | Cookies y almacenamiento del navegador | Informar sobre lo que el sitio guarda en el dispositivo y su finalidad. | No | Sí | P0 | Incluir esta información **dentro de la política de privacidad**. Inventariar sesiones, preferencias, borradores y Google. Determinar el consentimiento que corresponda a los tratamientos realmente activos; la existencia de cookies de sesión por sí sola no decide si hace falta un banner. |
| 25, 53 | Descripciones de las páginas | Dar a cada página pública un resumen útil para los buscadores. | No | Sí | P1 | Mantener los títulos existentes y preparar descripciones específicas a partir del **contenido ya aprobado**. Los 24 HTML revisados tenían títulos únicos, pero solo 8 descripciones distintas. Usar los metadatos de Astro sin añadir campos de administración ni cambiar textos visibles. |
| 33 | Contraste de colores | Comprobar que textos y controles se distingan bien de sus fondos. | No | Sí | P1 | Entregar un informe de todas las páginas y estados relevantes, incluidos los modos de accesibilidad. Mostrar propuestas con capturas de móvil y escritorio y obtener aprobación explícita **antes de cambiar el diseño**. La revisión preliminar limitada de portada no cierra esta tarea. |
| 36 | Enlaces externos | Comprobar que los enlaces lleven al destino correcto y que este siga disponible. | No | Sí | P1 | Verificar destinos externos y proponer las correcciones con evidencia. Un bloqueo automatizado o respuesta 403 no basta para declararlos rotos. Confirmar el destino correcto antes de sustituirlos; la revisión anterior no encontró rutas ni fragmentos internos rotos. |
| 41 | Sustituir contenido de prueba | Asegurar que la publicación pública contenga información real y aprobada. | No | Sí | P0 | **Conservar los ejemplos en local** mientras se prepara el contenido. Inventariar qué debe sustituirse: obras y siete propuestas compiladas muestran “Datos de ejemplo”. Revisar cifras, fechas, hitos, fotos y enlaces y reemplazarlos por material aprobado antes del lanzamiento. Conservar la semilla necesaria para pruebas. |
| A3 | Reforzar la política de contraseñas | Rechazar contraseñas con sucesiones de letras o números fáciles de adivinar. | No | Sí | P0 | Mantener el mínimo de **6 caracteres**, el máximo de 128 y los requisitos actuales de letra, número y símbolo. Rechazar sucesiones numéricas o alfabéticas contiguas de **4 o más** caracteres, ascendentes o descendentes, ignorando mayúsculas. Aplicar al crear, añadir, cambiar o restablecer una contraseña; conservar el acceso con contraseñas existentes. Detalle en la sección 3. |
| A4 | Reintentos y conflictos en perfil y chat | Evitar duplicar efectos al reenviar una petición o perder cambios de otra pestaña. | No | Sí | P0 | Corregir **ambos flujos**. En perfil, comprobar versión en la misma transacción y evitar repetir auditoría por un guardado ya aplicado. En chat, identificar cada envío para que un reintento no vuelva a sumar una pregunta sin respuesta. Garantizarlo en PostgreSQL y probar repetición y concurrencia. Detalle en la sección 4. |
| A5 | Auditoría especializada del historial Git | Buscar credenciales que puedan haber quedado en versiones antiguas. | No | Sí | P0 | Ejecutar el escaneo y entregar un **informe con hallazgos ocultando los valores sensibles**. El alcance acordado es auditar e informar; cualquier rotación, corrección o modificación del historial se acordará después de un hallazgo real. La revisión preliminar sin hallazgos no sustituye este escaneo. |
| A6 | Derechos y conservación de datos | Definir cómo atender acceso, corrección o eliminación y cuánto tiempo guardar los datos. | No | Sí | P0 | Preparar un procedimiento **manual por correo**, con verificación de identidad y registro de la atención. Dejar una lista de decisiones para el responsable: contacto, plazos de conservación, bases jurídicas, proveedores y tratamiento de información sensible. Los datos reales y los plazos se definirán después. El alcance actual es documental y manual. |
| A7 | Excluir páginas de cuenta de los buscadores | Evitar que páginas de acceso y gestión aparezcan como resultados de búsqueda. | No | Sí | P1 | Añadir `noindex` a **todas las rutas bajo `/cuenta/` y a la página 404**: registro, acceso, perfil, panel, recuperación, restablecimiento y verificación, entre otras. Mantenerlas fuera del futuro sitemap y conservar la indexación del contenido público. |

## 2. Pendientes para cuando haya VPS y dominio

Los alcances siguientes proceden de la revisión inicial. Se confirmarán las decisiones y se harán las preguntas de cada fila cuando estén disponibles el servidor, dominio y cuentas correspondientes. **A2 se reserva íntegramente para esta etapa**, por decisión del usuario.

| ID | Tema | Qué es | Hecho | Hacer | Prioridad | Alcance pendiente y dependencia |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | Cifrado de almacenamiento y respaldos | Evitar que quien obtenga un disco o una copia pueda leer los datos sin su clave. | No | Sí | P0 | Verificar las opciones reales de cifrado del VPS y proteger los respaldos externos, incluidas las claves y su recuperación. Depende del proveedor y del destino elegido para las copias. |
| 18 | Cabeceras de seguridad | Indicar al navegador qué recursos y comportamientos permite el sitio. | No | Sí | P0 | Definir y probar CSP compatible con Google, scripts y visor 3D; protección frente a incrustación, `nosniff`, política de referentes y otras cabeceras necesarias. Activar HSTS tras comprobar HTTPS. Verificar respuestas de página, API y errores en nginx y Cloudflare. |
| 26 | Datos estructurados | Dar a los buscadores información organizada sobre el sitio y su contenido. | No | Sí | P1 | Preparar JSON-LD con identidad y URL definitivas: persona, sitio y migas donde corresponda. Usar información verídica y aprobada. Requiere confirmar los datos del titular y el dominio. |
| 27, 52 | Sitemap y robots.txt | Facilitar la lista de páginas públicas y las instrucciones de rastreo a los buscadores. | No | Sí | P1 | Generar el sitemap con el dominio definitivo y actualizarlo con las publicaciones. Excluir cuenta y 404 conforme a A7. Configurar `robots.txt` y comprobar que permita rastrear el contenido público. |
| 32 | Velocidad real de carga | Medir cuánto tarda en aparecer el contenido útil con el alojamiento y la conexión reales. | No | Sí | P1 | Medir el sitio publicado con un perfil móvil y red lenta; revisar compresión HTTP, caché y momento de descarga del visor 3D y las animaciones. Elegir mejoras a partir de resultados. |
| 40 | Search Console | Verificar el dominio en Google y revisar la indexación. | No | Sí | P1 | Confirmar la cuenta y propiedad del dominio, verificarla si falta y enviar el sitemap cuando el sitio esté accesible. Requiere dominio y acceso a la cuenta elegida. |
| 43 | Vista previa al compartir | Mostrar título, resumen e imagen al compartir un enlace en redes o mensajería. | No | Sí | P1 | Añadir Open Graph y tarjetas con URLs absolutas del dominio definitivo y probar sus vistas previas. Las piezas gráficas nuevas se preparan en `design/` y requieren aprobación antes de incorporarse. |
| 45 | URLs canónicas | Señalar la dirección principal de cada página para evitar versiones duplicadas. | No | Sí | P1 | Elegir el dominio principal y el uso de `www`, configurar `site` en Astro, canonical y redirecciones coherentes. Revisar parámetros y variantes de host con el dominio real. |
| 46 | Avisos de caída | Recibir una notificación cuando el sitio o un servicio deja de responder. | No | Sí | P0 | Elegir monitor externo, destinatario y forma de notificación. Vigilar página pública, API y fallos de publicación. Los healthchecks locales de Docker no acreditan que existan avisos externos. |
| 47 | Certificados SSL y vencimientos | Mantener válidos los certificados que permiten la conexión HTTPS. | No | Sí | P0 | Comprobar certificados y conexión de Cloudflare al VPS. Universal SSL y Origin CA tienen ciclos distintos: verificar la renovación del certificado público y gestionar el vencimiento del certificado de origen. Corregir la documentación que afirma que uno de 15 años nunca necesita renovación. |
| A1 | Respaldos automáticos y restauración | Recuperar datos y archivos si el servidor se pierde o falla. | No | Sí | P0 | Definir frecuencia, destino externo, conservación, cifrado y responsable. Automatizar copias de PostgreSQL, fotos públicas y privadas y material necesario para reconstruir el sitio. Ensayar una restauración y documentar el resultado. |
| A2 | Mínimos privilegios de PostgreSQL | Dar a cada proceso solo los permisos que necesita. | No | Sí | P0 | Separar credenciales de inicialización o migraciones de las usadas por backend y publicador y comprobar los permisos reales. El compose revisado comparte el usuario de inicialización. Todo este punto se trabajará al disponer del VPS. |
| A8 | Verificación real del lanzamiento | Comprobar el sitio con los servicios, datos y configuración que usará el público. | No | Sí | P0 | Verificar DNS, HTTPS y redirecciones, correo, acceso con Google, certificados, cabeceras, caché, 404, enlaces y publicación. Revisar indexación, ausencia de secretos y ejemplos, móvil desde 320 px, orientación, límites de breakpoints, teclado y los ocho modos de accesibilidad. Probar también visor, scripts y reintentos. |

## 3. Política de contraseñas acordada

La decisión final sustituye la propuesta inicial de comparar la contraseña con el nombre del correo. La regla nueva evalúa **únicamente sucesiones numéricas y alfabéticas**, junto con los requisitos que el sitio ya exige.

- Mantener de **6 a 128 caracteres**, con al menos una letra, un número y un símbolo, y confirmación cuando corresponda.
- Detectar tramos **contiguos de 4 o más caracteres** de `0123456789` o `abcdefghijklmnopqrstuvwxyz`, en orden ascendente o descendente.
- Ignorar mayúsculas al comprobar letras; utilizar el alfabeto ASCII indicado como referencia.
- Mantener los separadores: la detección no elimina símbolos para unir tramos separados.
- Los patrones de teclado como `qwerty` y las repeticiones como `1111` o `aaaa` quedan fuera de esta nueva regla. Siguen sujetos a los requisitos actuales de composición y longitud.
- Aplicar en registro, creación por CLI, incorporación de contraseña a una cuenta de Google, cambio y restablecimiento. El inicio de sesión conserva el acceso con contraseñas existentes y no exige restablecerlas.
- Validar en backend y anticipar el error en frontend. La comparación no modifica la contraseña que se guarda mediante hash.

Ejemplos que deben rechazarse por sucesión: `1234567*a`, `abcde123*`, `Abcd1*` y `7654a*`. `Ab1!xy` cumple los requisitos y demuestra que el mínimo de seis se conserva. `juan124*` no se rechaza por coincidir con el correo, pues ese criterio fue sustituido.

Archivos de referencia: `backend/src/auth/password-policy.ts`, `backend/src/auth/services/registration.ts`, `backend/src/auth/services/passwords.ts`, `backend/src/cli/admin.ts`, `frontend/src/lib/auth/password.ts` y `frontend/src/lib/auth/page.ts`.

## 4. Contratos y verificación de perfil y chat

### Perfil

El contrato previsto añade `versionPerfil` a la lectura de `/api/me` y exige la versión cargada al guardar el perfil. PostgreSQL compara esa versión y los datos dentro de la misma transacción, con bloqueo de fila o mecanismo equivalente.

Un guardado ya aplicado debe devolver éxito sin cambiar otra vez la fecha ni insertar otra auditoría. Si los datos vigentes difieren de los que el usuario pretende guardar y otra edición cambió la versión, devolver 409 sin sobrescribir; la interfaz permite recargar y revisar los cambios. Un cliente que no tenga la versión debe recargar antes de guardar.

Actualizar juntos función SQL, servicio, esquema de petición, repositorios, tipos y formulario. Los botones se bloquean durante el envío y los errores visibles explican la acción necesaria con un mensaje breve.

### Chat

Añadir un UUID de idempotencia por envío lógico. El frontend conserva el UUID al reintentar el mismo envío y crea uno nuevo al formular otra pregunta.

La base garantiza que una misma clave y entrada produzcan el mismo resultado y como máximo un incremento del contador de preguntas sin respuesta. Reutilizar la clave con una entrada distinta produce 409. Dos preguntas iguales con UUID diferentes son dos envíos distintos y pueden contarse por separado.

Mantener la validación, límites y permisos actuales. Coordinar los cambios en esquema, servicio, función SQL, repositorios y cliente.

### Pruebas necesarias al implementar

- Perfil: repetición del mismo guardado sin auditoría duplicada; conflicto entre dos versiones concurrentes; guardado sin cambios y reintento de un guardado ya aplicado.
- Chat: reintentos y peticiones concurrentes con el mismo UUID suman una sola vez; reutilizarlo con otro contenido produce conflicto; UUID distintos siguen siendo envíos independientes.
- Contraseñas: mínimo de seis, sucesiones de tres frente a cuatro caracteres, ambos sentidos, mayúsculas, separadores, validación en todos los flujos y acceso con una contraseña existente.
- Ejecutar las pruebas de base en una **base desechable de pruebas**. La suite actual de integración trunca tablas y requiere comprobar `TEST_DATABASE_URL` antes de usarla.

## 5. Documentos, contenido y aprobación

Los borradores legales pueden prepararse ahora. Deben reflejar el uso real del sitio y señalar los datos pendientes sin inventar nombres ni contactos. Su publicación requiere completar información del responsable, conservación, bases jurídicas y proveedores. La presentación de las páginas nuevas se propone siguiendo sus equivalentes aprobadas y necesita el visto bueno visual exigido por `AGENTS.md`.

El procedimiento de derechos será manual por correo. Por ahora se prepara cómo recibir una solicitud, verificar identidad, registrar su atención y responder. Los plazos de conservación se acordarán con el responsable antes de cerrar la política; no se incorporan borrados automáticos en esta etapa.

Para contraste, primero se entrega el informe con capturas y propuestas. Para enlaces, se entregan destinos verificados y correcciones propuestas. Las descripciones SEO parten del contenido aprobado. Los ejemplos se conservan en local hasta contar con sus sustitutos definitivos.

## 6. Orden y criterios de cierre

1. Completar 20, A3, A4 y A5: dependencias afectadas, contraseñas, reintentos y auditoría de Git.
2. Preparar borradores de 21/51, 22/49, 23 y A6; inventariar sustituciones de 41 y registrar la información pendiente del responsable.
3. Completar 25/53 y A7; entregar informe de contraste y propuestas de enlaces de 33 y 36.
4. Al obtener VPS y dominio, realizar las preguntas de la segunda tabla, definir la configuración y completar seguridad, respaldos y permisos antes de recoger datos reales.
5. Cerrar metadatos del dominio, sitemap, vistas previas y Search Console; medir rendimiento y realizar A8 antes del lanzamiento.

Cada tarea se marca **Hecho: Sí** y **Hacer: No** únicamente después de implementar o verificar todo su alcance. A petición del usuario, las tareas cerradas se retiran de estas tablas de pendientes en la siguiente actualización.

Los cambios de software deben seguir `AGENTS.md`: backend modular y mínimo; garantías de concurrencia en PostgreSQL; pruebas de repetición y conflicto; diseño aprobado; originales preservados y errores públicos sin detalles internos. Los cambios de frontend requieren `bun run check`, `bun run build`, `bunx playwright test`, revisión visual móvil y escritorio y verificación en desarrollo de lo que dependa del navegador. Para 20, repetir también el escaneo después de actualizar las bibliotecas.

## 7. Evidencia previa y referencias

Los resultados siguientes corresponden al **1 de octubre de 2026** y son antecedentes del plan, no comprobaciones nuevas ni una validación del VPS:

- Frontend: comprobación de Astro sin errores ni advertencias, compilación de 24 páginas, 67 pruebas Playwright y 2 pruebas unitarias correctas.
- Backend: tipos correctos y 5 pruebas sin base correctas para proxy, respuestas defensivas y correo. No se ejecutó la suite que trunca tablas.
- Dependencias: frontend sin vulnerabilidades conocidas reportadas; backend con 14 avisos —3 altos, 10 moderados y 1 bajo—, 13 relacionados con Nodemailer y 1 con esbuild transitivo de herramientas de desarrollo. La aplicabilidad se revisa por cada aviso.
- HTML: 24 títulos únicos y 8 descripciones únicas; sin canonical, Open Graph ni noindex; sin imágenes sin `alt` y sin rutas o fragmentos internos rotos en lo compilado.
- Git: revisión preliminar de 44 commits y 410 objetos de texto sin hallazgos de los indicadores examinados; no sustituye el escaneo especializado ni cubre referencias remotas no disponibles.
- Desarrollo: páginas examinadas a 320, 390, 768 y 1440 px sin desbordamiento ni errores JavaScript registrados; capturas de móvil y escritorio revisadas. El contraste solo se comprobó de forma limitada en portada.
- Infraestructura: revisión de `server-produccion/compose.yml`, `nginx/default.conf` y `README.md`; no se accedió a un VPS, dominio, Cloudflare ni cuentas de Google.

Referencias del código para continuar: autenticación y respuestas en `backend/src/auth/`, `backend/src/http.ts` y `backend/src/security.ts`; perfil en `backend/src/profile/`; chat en `backend/src/participation/`; garantías SQL en `backend/database/fn.sql`; metadatos en `frontend/src/layouts/Layout.astro`, `frontend/src/pages/` y `frontend/astro.config.mjs`; ejemplos en `frontend/src/lib/data/mock/seed-data.ts` y contenido publicado por la API.

Fuentes oficiales consultadas durante la revisión inicial:

- [LOPDP publicada por una institución pública](https://www.finanzaspopulares.gob.ec/wp-content/uploads/2021/07/ley_organica_de_proteccion_de_datos_personales.pdf), especialmente artículos 4, 12 y 26, y [consultas de la SPDP de 2026](https://spdp.gob.ec/consultas2026/): información al recoger datos, derechos, bases jurídicas y tratamientos sensibles. La disponibilidad de una política y el consentimiento para un tratamiento son decisiones distintas.
- [Cloudflare Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/) y [Origin CA](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/): distinguir renovación del certificado público y vencimiento del certificado de origen.
- [Imagen oficial de PostgreSQL](https://hub.docker.com/_/postgres): el usuario de inicialización definido por `POSTGRES_USER` tiene privilegios de superusuario, motivo para separar las credenciales de ejecución.
- [Contraste según WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): referencia para el informe de contraste, normalmente 4,5:1 para texto y 3:1 para texto grande, con las excepciones previstas.
- [Aviso de Nodemailer sobre mensajes raw](https://github.com/advisories/GHSA-p6gq-j5cr-w38f): ejemplo de por qué se debe comprobar cada ruta de uso; no representa por sí solo los 14 avisos del backend.

## 8. Puntos cerrados

**17 — Reducir respuestas de la API. Hecho: Sí. Hacer: No. Cerrado el 2 de octubre de 2026.** Se retiró `esMaestro` de las respuestas de autenticación y perfil y del listado administrativo, incluidos los tipos del frontend. Se actualizaron las pruebas existentes y el README del backend. El campo interno `es_maestro`, el esquema, las funciones SQL, las reglas de jerarquía y la creación o transferencia del maestro se conservaron sin cambios.

Verificación: tipos de backend y frontend correctos; compilación de 24 páginas correcta; 9 pruebas de administración y 4 de autenticación correctas en una base nueva y desechable; 67 pruebas Playwright correctas. Se comprobó la prohibición de un segundo maestro y la jerarquía de permisos. En desarrollo, las capturas del panel con y sin el campo fueron idénticas a 320, 390, 768 y 1440 px, sin desbordamiento ni errores JavaScript; se revisaron las capturas de móvil y escritorio.
