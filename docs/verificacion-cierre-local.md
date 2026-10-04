# Verificación del cierre local

3 de octubre de 2026. Cubre la implementación acordada y las correcciones visuales aprobadas, sobre la copia local. El VPS y los proveedores definitivos todavía no se verificaron.

## Resultado

- Backend: tipos correctos y **69 pruebas, 932 comprobaciones, cero fallos**. Las pruebas que modifican tablas usaron bases nuevas y desechables, eliminadas al terminar, sin correos reales. Incluyen aceptación vigente, repetición y conflicto, semilla repetida y concurrente, conservación de ediciones e historial y 12 escrituras simultáneas de una misma foto.
- Frontend: revisión de **132 archivos**, cero errores, advertencias o sugerencias. Compilación normal contra la API local: **27 páginas**, sitemap y robots.txt. La compilación de prueba reutiliza la semilla en una carpeta separada.
- Navegador: **79 pruebas Playwright correctas**, con salida correcta del proceso. Incluyen Google nuevo y existente, consentimiento pendiente en los formularios, conservación de foto y texto, reintentos, panel, visor 3D y SEO. La API de estas pruebas está simulada; no acreditan entrega del proveedor de correo ni acceso Google en producción.

## Desarrollo y presentación

Se realizaron **2286 comprobaciones** sobre las 27 páginas y estados adicionales: siete secciones adicionales del panel, cuentas con y sin aceptación pendiente, perfil, errores de registro, menú y accesibilidad abiertos, y panel con usuarios y alertas cargados. La última ejecución incluye **17 769 mediciones** de ejemplos dentro de campos, bordes y foco del teclado.

Se revisaron 320, 390, 768 y 1440 px; también 359/360/361, 479/480/481, 759/760/761, 1198/1199/1200 y orientación de 844 × 390 en las vistas afectadas. Se comprobó el modo normal y los ocho ajustes del panel: contraste alto, fondo claro, negativo, gris, enlaces subrayados, fuente legible, movimiento reducido y ampliación al 125 %. Los límites adicionales se examinaron con los modos que afectan al tamaño; en horizontal se comprobaron los ocho.

El informe registra cero errores JavaScript, cero desbordamientos horizontales y cero fallos del contraste medido de texto, ejemplos dentro de campos, bordes y foco. La medición combina colores y transparencias y aplica los filtros de gris y negativo: 4,5:1 para ejemplos de campos y 3:1 para bordes y foco. Excluye texto sobre imágenes o degradados, controles desactivados, bordes nativos de casillas e iconos SVG, que requieren inspección visual. Las capturas de móvil y escritorio se revisaron para alineación de casillas, legibilidad, iconos y fondos. Esto no constituye una certificación integral de WCAG ni una comprobación del botón Google servido por el proveedor real.

Las comparaciones originales y la respuesta **«Apruebo todas las correcciones visuales»** precedieron a su implementación. La ampliación de ejemplos dentro de campos, bordes y foco se presentó en `controles.html` y recibió **«si apruebo»**. Se aplicó en cuenta, participación y panel con tokens y utilidades de Tailwind, manteniendo tamaños, posiciones, textos y aspecto de la casilla. Las seis capturas finales de registro y alerta, en móvil y escritorio y modos normal, gris y negativo, tienen las mismas dimensiones y **cero píxeles distintos** respecto a la propuesta aprobada.

Tras esa aplicación se repitieron `bun run check`, la compilación normal, la compilación de pruebas y las **79 pruebas Playwright**, con resultado correcto. El backend no cambió en esta ampliación; su resultado de 69 pruebas corresponde a la ejecución del bloque anterior. El punto 33 queda cerrado en local. Evidencia en `design/propuestas/cierre-plan/`: `propuestas.html`, `controles.html`, `auditoria-controles-final.json`, `comparacion-implementada.json` y capturas finales.

## Contenido y buscadores

Los ejemplos actuales se conservan por decisión del usuario. La fuente inicial es `backend/database/contenido-inicial.json`, incorporada a PostgreSQL; el contenido público se compila desde la publicación de la API. Los textos originales para restaurar provienen también de la base. La migración `0009_textos_iniciales.sql` está aplicada en local y la semilla no sobrescribe las ediciones ni las publicaciones existentes. Las fotos y pies simulados de pruebas permanecen aislados del funcionamiento público, sin respaldo de contenido de ejemplo al fallar la API.

Se verificaron descripciones distintas en las **19 páginas públicas**, canonical sin parámetros, JSON-LD válido, Open Graph y tarjetas con imagen JPEG disponible. La imagen procede de la portada existente y conserva el original. Las **siete rutas de cuenta y 404** tienen `noindex` y no aparecen en el sitemap. El sitemap se regenera con la compilación de cada publicación y robots.txt permite el rastreo público.

## Destinos externos

| Destino compilado | Resultado de la revisión |
| --- | --- |
| [Privacidad de Google](https://policies.google.com/privacy) | Página oficial disponible, destino correcto. |
| [SPDP](https://spdp.gob.ec/) | Sitio oficial disponible, destino correcto. |
| [Facebook](https://www.facebook.com/carlosastudillo7) | No verificable con la herramienta de consulta; no se declara roto ni se cambia. |
| [TikTok](https://www.tiktok.com/@carlosastudillo01) | No verificable con la herramienta de consulta; no se declara roto ni se cambia. |
| WhatsApp de la portada | Formato válido de enlace al número de semilla. Es un dato de ejemplo confirmado; se omite en las páginas legales. |

Los contactos salen del contenido publicado de la base y se editan en el panel. El usuario dejó su sustitución y comprobación al equipo; no se atribuye aquí titularidad a los perfiles ni validez real al teléfono.

## Lo que pasa al despliegue

Los 13 puntos pendientes se conservan en [el plan](plan-previo-publicacion.md): VPS, permisos, cabeceras, cifrado, respaldos y restauración, certificados, avisos, rendimiento, Search Console y comprobaciones con el dominio activo. JSON-LD, sitemap, canonical y vistas al compartir ya tienen su código preparado; falta verificarlos publicados.

Antes de recoger datos reales, el equipo completará proveedores, países y transferencias y la configuración efectiva de Google y correo. La revisión de privacidad local está en [su documento](revision-privacidad-local.md). La gestión manual de solicitudes, eliminación y conservación sigue asignada a los desarrolladores junto con Carlos Astudillo en A6; no se incorpora otro flujo ni se vuelven a pedir los plazos acordados.

No se hicieron commits, push ni despliegue remoto.
