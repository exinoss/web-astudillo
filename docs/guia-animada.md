# Guía animada: por qué funciona así

Decisión: D-040. Diseño aprobado: `design/propuestas/tutorial-guia/`. Código: `frontend/src/components/comun/GuiaAnimada.astro`, `frontend/src/scripts/comun/guia/` y `frontend/src/lib/comun/guia/`.

## Textos y audios

- Cada texto de `lib/comun/guia/pasos.ts` es el que se grabó en `assets/audio/tutorial/<id>.mp3`. Si cambia un texto, hay que volver a grabar su audio (originales en `design/propuestas/tutorial-guia/audios/`; el sitio usa copias a 64 kbps).
- El cursor y el foco llegan a cada elemento cuando la voz dice la palabra `en` de su visita, 0,4 s antes (`momentos()`). La prueba `test-unit/guia-pasos.test.ts` avisa si una palabra ya no está en su texto.

## Audio

- Los navegadores no dejan sonar nada hasta que la persona toca la página. Si `play()` se rechaza con `NotAllowedError`, la guía muestra «Continuar» y la invitación espera el primer toque, clic o tecla. Ese `play()` tiene que llamarse dentro del propio evento: después de un `await`, Safari y Chrome ya no lo permiten.
- Un `<audio>` solo puede conectarse una vez a un `AudioContext` (`createMediaElementSource`). Como al cerrar la guía se cierra su contexto, cada guía crea un `<audio>` nuevo; si no, la siguiente sonaría por un contexto cerrado, es decir, en silencio.

## Movimiento del recorrido

- Tras mover el cursor a un elemento, el recorrido solo espera 0,65 s si hay que pulsarlo o si quedan elementos del mismo grupo (los cuadros de propuestas). Esperar siempre retrasaba la visita siguiente y el foco llegaba tarde a la voz.
- Los subtítulos se deslizan 0,7 s al cambiar de lado. La ventana del correo (paso 13) se mide con su destino (`style.left`), no con su posición a mitad del movimiento; si no, salía encima y pequeña en lugar de a la derecha.
- El botón de Google se dibuja tarde o el navegador puede bloquearlo (la prevención de seguimiento de Edge). Mientras no está, la visita del paso 11 señala su hueco (`#google-login-button:empty`).

## Carga

- El runtime se carga por URL (`?url` + `cargarScript`) para poder reintentar: un `import()` que falla queda memorizado por el navegador.
- El atlas se sirve tal cual con `?url`, no con `astro:assets`: es una hoja de sprites para el lienzo y recomprimirla movería los bordes de cada pieza.

## Pruebas

- En `tests/inicio-carruseles.spec.ts`, la prueba del video del carrusel de piezas entra con `guia-vista` guardado: con el reloj simulado de Playwright, el bucle de animación de Carlos en la invitación adelanta el carrusel. Con tiempo real no pasa.
- Al retomar la guía en otra página sin un clic previo, el navegador de pruebas puede bloquear el audio; las pruebas pulsan «Continuar» si aparece.
