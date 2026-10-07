# Aviso legal — borrador

Documento de trabajo del **3 de octubre de 2026** para el punto **21** del plan previo a la publicación. La página está incorporada al frontend con la presentación aprobada. El sitio todavía no está desplegado; disponer de esta página no acredita el cumplimiento de los pendientes de privacidad, cookies o consentimiento.

## Texto propuesto

### Responsable y contacto

Este es el sitio de Carlos Astudillo, candidato por la lista 6 a la Alcaldía del cantón San Lorenzo, provincia de Esmeraldas, Ecuador.

El responsable del sitio y del tratamiento de los datos personales es **Carlos Astudillo**.

- Domicilio indicado, sede del partido: Av. Esmeraldas y C. 29 de Abril, 080501 San Lorenzo, Esmeraldas, Ecuador.
- Correo de contacto y solicitudes sobre datos personales: **lanuevahistoria6@gmail.com**.
- Teléfono / WhatsApp de atención: **[PENDIENTE: número real de atención antes del lanzamiento]**.
- Canales adicionales: **Facebook y TikTok [PENDIENTE: incorporar los enlaces oficiales publicados]**.
- Sitio web: **[lanuevahistoria.tech](https://lanuevahistoria.tech/)**.

### Finalidad del sitio

El sitio presenta información sobre Carlos Astudillo y permite enviar alertas sobre problemas del cantón, sugerencias y consultas. El registro y la participación no constituyen afiliación a una organización política.

Las comunicaciones enviadas mediante el sitio son atendidas por su equipo. Su recepción no garantiza una intervención, la solución del problema comunicado ni una respuesta de una institución pública.

### Datos personales

Para consultar información sobre los datos que se recogen, sus usos, conservación y derechos, revisa la [Política de privacidad](https://lanuevahistoria.tech/politica-de-privacidad/).

Puedes enviar solicitudes relacionadas con tus datos personales a **lanuevahistoria6@gmail.com**. Las condiciones para crear una cuenta y participar se explican en los [Términos y condiciones](https://lanuevahistoria.tech/terminos-y-condiciones/). Estas rutas están implementadas y estarán disponibles al desplegar el sitio.

## Información que falta antes de publicar

- Confirmar quién atenderá el correo y completar el procedimiento de derechos del punto A6.
- Sustituir el WhatsApp de prueba por el número real de atención, autorizado por el responsable, y comprobar que esté publicado y atendido. Utilizar ese mismo número en el aviso y la privacidad. Confirmar también los enlaces oficiales de Facebook y TikTok; Instagram se incorporará cuando se haya añadido al sitio.
- Completar la revisión de bases jurídicas, proveedores, países de tratamiento y transferencias de privacidad, junto con consentimiento y declaración de edad. Las tres páginas ya existen y sus enlaces internos están incorporados.
- Verificar los datos y servicios efectivos de producción en A8. La presentación corregida ya tiene aprobación explícita y está implementada; no requiere volver a aprobarse sin cambios.

## Datos confirmados y observación legal interna

El usuario confirmó **Carlos Astudillo** como nombre para la identificación legal, el domicilio indicado como sede del partido y **https://lanuevahistoria.tech/** como dominio. Estos datos dejan de figurar como pendientes. La dirección conserva los datos facilitados, corrigiendo únicamente la repetición «y y».

El usuario aclaró que el número real de WhatsApp que configure el administrador podrá utilizarse como teléfono público de atención. Esta decisión sustituye la anterior de publicar únicamente correo. El WhatsApp actual es de prueba y no se considera un contacto real del responsable; no se copia su valor a este borrador.

El artículo 12, numeral 8, de la LOPDP incluye teléfono entre los datos de contacto del responsable. Se propone usar el número público de atención de la campaña, identificado como «Teléfono / WhatsApp», siempre que permita contactar con el responsable o su equipo autorizado. Antes de cerrar el punto debe confirmarse el número real y su atención; la validación del formato o la presencia de un enlace no acreditan esos hechos. [LOPDP, art. 12](https://www.finanzaspopulares.gob.ec/wp-content/uploads/2021/07/ley_organica_de_proteccion_de_datos_personales.pdf).

Facebook y TikTok complementan la comunicación general. Instagram está previsto, pero no está implementado en los canales del sitio revisado; no se añade un perfil ficticio. El correo acordado sigue siendo el canal previsto para solicitudes sobre datos personales.

Las páginas de aviso y privacidad reutilizan el componente `frontend/src/components/legal/LegalContact.astro`, que obtiene `enlace.whatsapp`, `enlace.facebook` y `enlace.tiktok` del contenido publicado mediante el repositorio existente. Muestra el número de WhatsApp junto a su enlace, sin un campo duplicado ni una copia fija, y omite el número conocido de la semilla. El equipo colocará y publicará el número real después del despliegue, antes del lanzamiento público; no lo colocará el usuario. Guardarlo como borrador no actualiza la web: se reflejará en las páginas cuando se publique el contenido y termine la reconstrucción estática existente. Se comprobará entonces que el número sea real, autorizado y atendido. Facebook y TikTok se muestran solo si hay enlaces publicados con HTTPS y dominio permitido.

La propuesta aislada de `design/propuestas/politicas/` recibió aprobación explícita después de corregirse. Las tres páginas ya están incorporadas al frontend, con fondo blanco y enlaces legales centrados en la misma fila del copyright, sin añadir otra franja al pie. Esta integración no modifica el registro ni implementa consentimiento o borrado de datos.

La identificación de Carlos como responsable procede de la decisión del usuario. No se atribuye esa función al PSC ni se presupone que el equipo del sitio sea una persona jurídica independiente.
