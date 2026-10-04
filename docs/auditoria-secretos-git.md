# Auditoría de secretos en Git — A5

Realizada el **3 de octubre de 2026** sobre la copia local de `web-astudillo`. HEAD al comenzar: `3b91309c64137afe32433076963e98053dc27943`. El alcance aprobado fue auditar e informar, con los valores sensibles ocultos.

## Resultado

**No se confirmaron credenciales reales expuestas en el contenido de Git analizado.** Los avisos de Gitleaks corresponden a claves ficticias de pruebas y a un texto instructivo de una plantilla antigua. La comparación con la configuración local encontró únicamente el valor de ejemplo del correo de pruebas Mailpit.

A5 queda completado como auditoría. Los resultados no aportan un hallazgo que requiera rotación de credenciales o reescritura del historial en esta etapa. La conclusión se limita a la copia y al contenido indicados abajo.

## Herramienta y método

Se utilizó **Gitleaks 8.30.1 para Windows x64**, descargado de la [publicación oficial](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1). La suma SHA-256 del ZIP coincidió con el [archivo de sumas publicado](https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt):

```text
d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e
```

La herramienta se ejecutó desde una carpeta temporal, con sus reglas incorporadas, `--redact=100` y sin baseline ni exclusiones propias del proyecto. Se desactivó la aceptación de comentarios `gitleaks:allow` mediante `--ignore-gitleaks-allow`; las excepciones incorporadas en las reglas de Gitleaks siguen formando parte de su configuración. Los informes se revisaron seleccionando ubicación y regla, sin copiar el campo de secreto ni el contenido de la coincidencia al documento.

Se realizaron tres escaneos complementarios:

1. **Cambios históricos:** comando `git` de Gitleaks con `--log-opts="--all --reflog --full-history -m"`, para incluir todas las referencias disponibles y los reflogs locales. Este modo analiza los cambios mediante `git log -p`, según su [documentación oficial](https://github.com/gitleaks/gitleaks/blob/v8.30.1/README.md).
2. **Archivos históricos completos:** se enumeraron los objetos almacenados mediante `git cat-file --batch-all-objects`, se extrajeron los blobs de texto en una carpeta temporal y se analizaron con el comando `dir`. Se conservaron sus identificadores y se reconstruyeron las rutas desde árboles y commits, también para objetos sin una referencia vigente.
3. **Estado de trabajo:** se analizaron copias de los archivos de texto enumerados por `git ls-files -c -o --exclude-standard`, incluidos los cambios todavía sin commit. Las dependencias, compilaciones y archivos ignorados no forman parte de este conjunto.

Como comprobación adicional, se compararon en memoria **cinco valores** de configuración sensible presentes en los `.env` locales, incluido uno comentado, con los textos históricos. Se incluyeron la URL de base de datos, su contraseña, el secreto JWT y contraseñas SMTP. Sus valores no se incluyen en el informe.

## Cobertura

| Elemento | Resultado |
| --- | --- |
| Copia local | No es un clon superficial. |
| Commits accesibles por referencias y reflogs | 45, con fechas del 19 de septiembre al 2 de octubre de 2026. Gitleaks registró 42 commits en su escaneo de cambios; el escaneo de archivos completos complementó esa revisión. |
| Referencias incluidas | `main`, referencias locales de `origin`, etiqueta `frontend-parity-v1`, respaldos bajo `refs/original/` y referencias locales de captura de Codex. |
| Reflogs | 27 identificadores de commit distintos en las entradas locales; no añadieron commits a los 45 anteriores. |
| Base local de objetos | 1.545 objetos, incluidos 47 objetos de commit y 926 blobs. |
| Blobs de texto analizados | 882, aproximadamente 10,7 MB; 245 estaban fuera del conjunto accesible por referencias y reflogs. |
| Blobs binarios | 44, excluidos del escaneo de texto. |
| Archivos de texto actuales analizados | 245, incluyendo archivos modificados y nuevos todavía sin commit. |
| Archivos de entorno privados actuales | `backend/.env` y `frontend/.env` están ignorados y no figuran en el índice de Git. Se usaron únicamente para la comparación de valores en memoria. |

Los números de objetos describen el inventario al realizar el escaneo; pueden variar si se crean commits, capturas o se ejecuta la limpieza de objetos de Git.

## Avisos revisados

Gitleaks produjo **2 avisos en los cambios históricos**, **18 en los blobs completos** y **3 en el estado de trabajo**. Son apariciones de valores en distintas versiones, no 23 credenciales diferentes. Todos utilizaron la regla `generic-api-key`; ninguno se clasificó como una credencial real expuesta.

| Ubicación | Apariciones en blobs | Identificación | Clasificación y evidencia |
| --- | --- | --- | --- |
| `backend/tests/auth.test.ts` | 12 | Aviso histórico en línea 15 del commit `6e5824c96e1719296b2384ddf1f2e342166e41f0`; versión actual en línea 16. | `jwtSecret: [OCULTO]`. Valor explícito de pruebas en una configuración con `production: false`, base desechable y dobles de correo y Google. No coincide con el secreto JWT local. |
| `backend/tests/helpers.ts` | 3 | Aviso histórico en línea 17 del commit `b3c98e8216134ba5427a33d5500a7628268ac589`; versión actual en línea 20. | `jwtSecret: [OCULTO]`. Configuración de `testApp`, que exige `TEST_DATABASE_URL` y prepara cuentas de pruebas. No coincide con el secreto JWT local. |
| `backend/tests/mail.test.ts` | 1 | Línea 69; también aparece entre los cambios actuales todavía sin commit. | `jwtSecret: [OCULTO]`. Configuración de la prueba SMTP con receptor local en un puerto libre. No usa el secreto JWT ni el SMTP privado del `.env`. |
| `backend/.env.deploy.example` | 2 | Línea 5 de los blobs `18b4400135135dd0567e03e1c40e14b30add86c8` y `75e57a43e91e2c7e4124efb6794aa0675d751c9f`. No accesibles por referencias o reflogs en el inventario revisado. | `JWT_SECRET=[OCULTO]`. Texto instructivo sobre longitud de la clave, dentro de una plantilla que indica no subir valores reales. No coincide con el secreto JWT local. No se atribuye un commit a estos blobs porque no se encontró esa asociación en los commits locales. |

La comparación de los valores locales produjo **seis coincidencias** adicionales con `SMTP_PASS`: tres versiones de `backend/.env.mailpit.example`, en líneas 5 o 6, y tres de `frontend/LO_QUE_DEBES_PREPARAR.md`, en línea 33. Estos objetos antiguos tampoco eran accesibles por referencias o reflogs. Corresponden al valor de ejemplo de **Mailpit**, que coincide con la configuración SMTP local de pruebas en el puerto 1025. `backend/compose.mailpit.yml` limita sus puertos a la interfaz local y configura aceptación de cualquier credencial de prueba. No hubo coincidencias con el secreto JWT, la conexión o contraseña de la base, ni con la contraseña SMTP comentada.

## Límites y seguimiento

- Se revisó el contenido disponible en esta copia local. No se consultaron ramas adicionales del servidor remoto, otros clones, respaldos externos, registros de CI ni credenciales guardadas fuera del proyecto.
- El escaneo de objetos fue de texto: no se inspeccionaron secretos dentro de imágenes, modelos, contenedores binarios o archivos comprimidos. Tampoco acredita la ausencia de secretos en mensajes de commit, configuración privada de Git o recursos externos.
- Las reglas automáticas y la comparación de valores conocidos no garantizan detectar todo secreto posible. No se probaron las credenciales contra servicios externos ni se verificó su validez ante proveedores.
- La configuración final y el contenido que se publique se volverán a revisar en A8. Esta auditoría no valida el futuro VPS ni sustituye la revisión de nuevos cambios.

Solo se modificaron este informe y el [plan previo a publicación](plan-previo-publicacion.md). Las fuentes, archivos privados de configuración, índice, HEAD y referencias de usuario se comprobaron sin cambios respecto al inicio. Los recursos temporales de la auditoría se retiraron al terminar. No fue necesario ejecutar pruebas de aplicación porque no se modificó código de backend o frontend.
