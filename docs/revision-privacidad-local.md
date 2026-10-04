# Revisión local de privacidad y servicios

3 de octubre de 2026. Responsable: Carlos Astudillo. Ejecución manual: desarrolladores y Carlos Astudillo. Esta revisión cubre el código y las decisiones actuales; los proveedores, países y configuración del VPS se completarán en el despliegue.

## Finalidades y bases

| Tratamiento | Datos mínimos | Base y límites |
| --- | --- | --- |
| Cuenta, alertas, sugerencias y consultas | Nombre, correo, identificador de acceso y aportaciones elegidas por el usuario | Consentimiento explícito acreditado; dirección y foto opcionales. Sin afiliación, publicidad ni perfiles políticos. |
| Prueba de aceptación | Cuenta, versión, texto y fecha | Acreditación del consentimiento y términos; no se piden documentos ni fecha de nacimiento. |
| Protección del sitio | Sesión, identificador de cuenta, IP y contadores de intentos, registro de operaciones | Interés legítimo limitado a seguridad, según la ponderación de abajo. No reutilizarlo para marketing o campaña. |
| Petición de autoridad | Información estrictamente necesaria para el caso | Solo una obligación legal o requerimiento legítimo concreto, comprobado por el equipo. |
| Fotos en charlas | Foto de daños que no identifique a ninguna persona | Licencia gratuita y limitada de los términos; no es autorización de tratamiento público de datos personales. |
| Estadísticas posteriores | Agregados irreversiblemente anónimos | Fuera de la base personal; aplicar el plazo aprobado de tres años desde el cierre. |

La LOPDP, artículos 21 y 24, permite consentimiento explícito y ejercicio directo de derechos de los adolescentes en los rangos que establece. El sitio mantiene el mínimo aprobado de 16 años y explica finalidades, riesgos y contacto sin añadir exigencia general de autorización parental. La facultad de consentir datos no demuestra por sí sola la titularidad ni capacidad contractual para licenciar una foto: el equipo comprobará autoría, representación cuando corresponda y derechos de terceros antes de usarla. [LOPDP](https://www.finanzaspopulares.gob.ec/wp-content/uploads/2021/07/ley_organica_de_proteccion_de_datos_personales.pdf), [reglamento general](https://spdp.gob.ec/wp-content/uploads/2024/12/04.pdf.pdf).

## Ponderación: protección de cuentas y prevención de abuso

Se aplica la metodología del anexo de la [Resolución SPDP-SPD-2025-0041-R](https://spdp.gob.ec/wp-content/uploads/2025/11/41.01.01-SPSP-SPD-2025-0041-R-Normativa-general-para-la-aplicacion-del-interes-legitimo-y-su-anexo.pdf), con el supuesto de seguridad de redes del artículo 14. No se extiende a otras finalidades.

**Finalidad real:** impedir accesos indebidos y envíos abusivos que expongan mensajes y fotos privados o impidan participar. El beneficio también alcanza a adolescentes: conservar la privacidad y disponibilidad de su cuenta y evitar suplantaciones.

**Necesidad:** las comprobaciones de sesión, permisos vigentes, intentos y repetición de envíos son necesarias para proteger las funciones actuales. Usar únicamente contadores globales bloquearía a todos ante el fallo de una persona y no protegería cuentas concretas. Pedir identificación oficial o fecha de nacimiento sería más intrusivo. No se emplean huellas del dispositivo, historial de navegación ni perfil político.

**Impacto y expectativas:** se utilizan identificadores básicos y datos técnicos, con restricciones temporales que pueden afectar a una conexión compartida o a un usuario legítimo. El contexto político y las cuentas de 16 y 17 años exigen cuidado reforzado. La justificación para adolescentes se limita a proteger sus propias cuentas y aportaciones; no permite segmentarlos ni reutilizar datos para campañas. El texto público informa de límites y revisión por correo.

**Medidas comprobadas:** las fotos de alertas y aportaciones permanecen privadas; autor y equipo acceden según permisos; cookies de sesión protegidas, credenciales verificadas, consultas parametrizadas, comprobaciones defensivas y registros de aceptación. La dirección es opcional y no se piden números de vivienda. Hay límites temporales y vías de recuperación; el equipo puede revisar incidencias y oposición por el correo publicado. Evidencia: `backend/src/auth/`, `backend/src/participation/`, `backend/database/fn.sql`, pruebas de autenticación, consentimiento y participación. El cifrado de discos, respaldos y acceso operativo se verificarán en el VPS, sin darlos por implementados.

**Conservación efectiva:** las ventanas en memoria caducan y se limpian con actividad; los contadores persistentes limpian registros antiguos no bloqueados al registrar fallos. Eso no garantiza borrado durante inactividad. Sesiones, auditoría y comprobantes están incluidos en la gestión manual y el máximo aprobado de 60 días desde el cierre. No crear retención adicional de pruebas personales para prolongar el uso de fotos.

**Resultado del análisis local:** el uso mínimo para seguridad resulta proporcionado con esos límites y salvaguardas; se excluye el uso público o electoral de identificadores. Carlos Astudillo deberá asumir esta evaluación y completar riesgos de infraestructura, proveedores y transferencias antes de recoger datos reales. Revisarla ante un cambio de finalidad, servicio o incidente. La versión íntegra se conserva para la SPDP; el titular puede obtener por correo una explicación accesible sin detalles que comprometan la seguridad.

## Fotografías

El permiso comprende mostrar fotos de daños en charlas e incorporarlas a presentaciones, con recortes, ajustes, combinaciones y texto explicativo. Conserva ámbito, gratuidad y plazo; no autoriza publicar datos personales ni falsear hechos. Se respetan los derechos morales, incluida atribución o exclusión del nombre según corresponda. Una solicitud de atribución se atiende por separado, sin exponer automáticamente el correo o perfil. El equipo revisa cada foto y su autorización antes de utilizarla. No se presume permiso retroactivo. [Código Ingenios, artículos 118, 120, 166 y 167](https://www.derechosintelectuales.gob.ec/wp-content/uploads/downloads/2021/agosto/a_2_16_codigo_ingenios_agosto_2021.pdf).

La versión vigente pasa a `2026-10-03.2`; la casilla y sus finalidades conservan el texto aprobado. Las pruebas de versiones anteriores siguen almacenadas y no se convierten automáticamente en aceptación del alcance nuevo.

## Cookies y Google

Se mantiene Google Identity Services como está: único servicio externo de acceso elegido, SDK al mostrar la pantalla de cuenta cuando está configurado, sin analítica ni píxeles. La carga del SDK precede al clic y puede comunicar datos técnicos a Google; no se la presenta como posterior al consentimiento de registro. [Botón oficial de Google](https://developers.google.com/identity/gsi/web/guides/display-button), [privacidad de Google](https://policies.google.com/privacy).

Se conserva el inventario de cookies de sesión, accesibilidad, voz, edición y borradores locales de `politica-privacidad-borrador.md`. No se añade un banner genérico para un conjunto inexistente de servicios opcionales. Esta decisión local no exonera de revisar el flujo real, las condiciones del servicio y transferencias de Google y proveedores al desplegar. Cualquier analítica o publicidad futura requiere revisar información y autorización antes de cargarla.
