# Visitas del sitio y visitas de Cloudflare

Por qué la cifra de Cloudflare (más de 7.000) y la de la portada (unas 400-570) no se pueden comparar directamente, y cómo se cuenta cada una. Decisión: D-039.

## Qué mide cada cifra

| | Contador del sitio (portada) | Cloudflare, *Analytics* de la zona |
| --- | --- | --- |
| Qué cuenta | Una visita por navegador. Cuenta otra si vuelve a cargar o navegar tras 30 minutos sin actividad. | **Visits:** cada página HTML servida con éxito cuyo `Referer` no es el propio dominio (entrada directa o desde otro sitio). **Unique visitors:** IP distintas. |
| Quién cuenta | Navegadores que ejecutan el JavaScript del sitio. | Todo lo que pide una página: personas, robots, monitores, previsualizaciones de enlaces y escáneres. |
| Periodo | Acumulado desde que existe `tb_visitas_dia` (migración 0012), por días en hora de Ecuador. | El que se elija en el panel (24 h, 7 o 30 días), en UTC. |
| Fuente | `fn_visit_register` (`backend/database/funciones/estadisticas.sql`). | [Zone Analytics](https://developers.cloudflare.com/analytics/account-and-zone-analytics/zone-analytics/), [About Cloudflare Analytics](https://developers.cloudflare.com/analytics/faq/about-analytics/). |

## Lo que infla la cifra de Cloudflare

1. **Upptime** (`docs/guia.md` 5.6) pide la portada cada 5 minutos desde GitHub, a través de Cloudflare y sin `Referer`. Cada petición es una «Visit»: hasta 288 al día, unas 2.000 por semana y 8.600 en 30 días si GitHub ejecuta todas las programadas (suele retrasar algunas). Solo esto puede explicar la mayor parte de las 7.000.
2. **Robots y previsualizaciones:** buscadores, rastreadores de IA y la vista previa de enlaces de WhatsApp, Facebook o Telegram cada vez que se comparte el sitio. Piden el HTML pero no ejecutan el JavaScript, o se presentan como robots.
3. **Escáneres** que prueban rutas (`/wp-login.php`, `/.env`…). Cuentan si la respuesta es una página HTML con éxito.
4. **«Unique visitors» por IP:** una persona con celular y wifi son dos, y la IP del celular cambia durante el día.

## Lo que hundía la cifra del sitio (corregido con D-039)

1. **Una visita por IP cada 30 minutos.** Detrás de un mismo wifi, o de la red móvil (las operadoras comparten una IP pública entre muchos clientes, CGNAT), solo contaba la primera persona.
2. **Sin reintento:** el navegador marcaba la visita como contada antes de enviarla. Si la petición fallaba, se perdía.
3. **Una vez por sesión de la pestaña:** quien dejaba la pestaña abierta y volvía horas después no sumaba otra visita.

## Cómo comparar las dos cifras

1. En Cloudflare, el mismo periodo para las dos y, en *Analytics & Logs → Traffic*, filtrar:
   - **ASN 8075 (Microsoft):** de ahí salen los ejecutores de GitHub Actions, es decir, Upptime. Se excluye.
   - Ruta `/` frente a las demás: Upptime solo pide la portada.
   - *Security → Bots* (si el plan lo muestra): tráfico de robots verificado y probable.
2. En el VPS, las visitas del sitio por día del mismo periodo:
   ```bash
   docker compose exec db psql -U postgres -d astudillo -c "SELECT dia, total FROM tb_visitas_dia ORDER BY dia DESC LIMIT 30;"
   ```
3. Tras D-039, lo esperable es que la cifra del sitio suba (ya cuentan las personas que comparten red) y siga por debajo de las «Visits» de Cloudflare sin Upptime ni robots. Las dos solo coinciden si se descuenta todo lo anterior.

## Filtros del contador

- No cuentan la vista previa del borrador, el panel (`/cuenta/panel/`), los navegadores automatizados (`navigator.webdriver`) ni los agentes que se presentan como robots (`AUTOMATIZADO` en `backend/src/stats/services/stats.ts`).
- Una IP suma como mucho 120 visitas nuevas por hora. Basta para mucha gente detrás de una misma red y frena a un script que invente identificadores. Lo que pase del tope no se cuenta, pero la página funciona igual.
- Un navegador que bloquea todo el almacenamiento no cuenta: sin el número no se distingue una recarga de una visita nueva, y contarlo inflaría la cifra.
