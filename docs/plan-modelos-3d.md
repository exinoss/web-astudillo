# Plan — Modelos 3D interactivos en las páginas de propuesta

> Estado: **pendiente**. Planificado, no implementado. Falta la ficha técnica enviada al proveedor y la aprobación de diseño del bloque en la página de detalle.

## Contexto

El equipo de diseño ya tiene **un modelo 3D animado por cada una de las 7 propuestas**. Se quieren mostrar en la página de detalle de cada propuesta, y el visitante debe poder **girarlos y hacer zoom** (no solo verlos reproducirse).

La pregunta que originó esto: *¿en qué formato hay que pedirlos para que se vean en la app sin hacerla pesada?* La respuesta corta es **glTF 2.0 binario (`.glb`)**, pero el formato es solo una parte — lo que de verdad decide el peso son los presupuestos de geometría y textura, y esos hay que exigirlos por escrito.

### Contra qué estamos comparando

El sitio hoy es excepcionalmente liviano, y eso es lo que está en juego:

| | Peso actual |
|---|---|
| **Todo el JavaScript del sitio** | **4,6 KB** |
| CSS | 45 KB |
| HTML de una página de propuesta | 30 KB |
| **Total de una página de propuesta** | **≈ 85 KB** |

Cero dependencias de runtime (`frontend/package.json` solo tiene `astro` y las fuentes). `output: 'static'`.

El motor 3D solo pesa más que todo el sitio junto. Cifras aproximadas, a verificar al implementar:

| Componente | Peso (gzip) |
|---|---|
| `<model-viewer>` de Google | ~300 KB |
| three.js a mano (core + GLTFLoader + OrbitControls) | ~150 KB |
| Decodificador Meshopt | ~15 KB |
| Decodificador Draco (alternativa) | ~90 KB |
| Modelo GLB optimizado | 300 KB – 1,5 MB |
| Modelo GLB **sin** optimizar (lo típico que entrega un artista) | 5 – 50 MB |

**El público está en San Lorenzo: móvil, datos limitados, Android de gama media-baja.** WebGL ahí no solo pesa, también calienta el equipo y gasta batería. De ahí que la carga diferida no sea un adorno sino un requisito.

---

## Decisiones técnicas

### Formato: `.glb` (glTF 2.0 binario)

Es el estándar de la web para 3D — el «JPEG del 3D». Un solo archivo binario que lleva geometría, materiales PBR, texturas y animaciones. Lo cargan todos los motores web sin conversión.

**Se rechaza todo lo demás**: `.fbx` (propietario, pesado, necesita conversión), `.obj` (no lleva animación ni PBR), `.dae`, `.3ds`, `.stl`, y los formatos de autoría (`.blend`, `.max`, `.c4d`) — esos se piden aparte solo como archivo maestro para re-exportar.

### Motor: `<model-viewer>` de Google

Es el doble de pesado que un three.js a medida (~300 KB contra ~150 KB), y aun así se recomienda:

- Trae **póster, carga diferida, teclado, ARIA y `alt`** ya resueltos. Escribir eso a mano son 250-300 líneas de JS en un proyecto cuyo JS entero son ~230 líneas: duplicaría la superficie a mantener.
- Maneja solo los decodificadores (Meshopt/Draco/KTX2), la pérdida de contexto WebGL al cambiar de app en móvil y los límites de memoria de iOS — justo donde falla el código artesanal.
- Deja la puerta abierta a RA («ver el mercado en tu calle») sin rehacer nada.

**El costo se mitiga con carga diferida**: nada de WebGL se descarga hasta que el bloque entra en pantalla, y se cachea entre las 7 páginas. Un visitante que no baja hasta el modelo paga 0 KB.

Si más adelante se quieren recuperar esos 150 KB, el cambio queda contenido en un solo componente.

---

## Ficha técnica para el proveedor 3D

Esto es lo que hay que enviarles. Cada punto existe por una razón de peso o de compatibilidad.

### Entrega

- **Un archivo `.glb`** (glTF 2.0 binario) por propuesta, con todo embebido.
- Nombre: `<slug-de-la-propuesta>.glb` → `agua-potable.glb`, `mercado-municipal.glb`, `terminal-terrestre.glb`, `agronomia.glb`, `educacion.glb`, `centro-de-alto-rendimiento.glb`, `tecnologias-emergentes.glb`.
- **Archivo maestro aparte** (`.blend`, `.fbx` o el nativo que usen) por si hay que re-exportar. No va al sitio.
- **Una imagen de póster** por modelo: PNG 1200×1200, fondo transparente, el modelo en su pose de reposo. Se muestra mientras carga.

### Presupuesto de peso

- **Objetivo: ≤ 1,5 MB** por `.glb` ya exportado.
- **Límite duro: 3 MB.** Por encima de eso se devuelve para reexportar.

### Geometría

- **≤ 50.000 triángulos** por modelo. Ideal 15.000–30.000.
- Modificadores **aplicados** (subdivisión, espejo, solidificar). Sin subdivisión sin hornear.
- Solo triángulos y quads, sin n-gons.
- **Escala real en metros**, eje **Y arriba** (convención glTF), origen en la base del objeto.
- Transformaciones aplicadas: escala `1,1,1`, rotación `0,0,0`.

### Materiales y texturas

- **PBR metallic-roughness** (el estándar glTF). **No** specular-glossiness.
- **Máximo 2-3 materiales** por modelo. Ideal: uno solo con atlas.
- Texturas **≤ 2048×2048**, preferible **1024×1024**. Sin 4K.
- Canales **empaquetados en ORM**: oclusión en R, rugosidad en G, metalicidad en B, en una sola imagen.
- Sin texturas de 16 bits.

### Animación

- **Horneada dentro del `.glb`**, con el clip nombrado (`idle` o `demo`).
- **Bucle limpio**: el último fotograma empalma con el primero sin salto.
- **≤ 10 segundos**, 24–30 fps.
- **Sin animación de cámara** — la cámara la controla el visitante.
- Si es esqueletal: ≤ 60 huesos, ≤ 4 influencias por vértice.

### Qué NO debe venir en la escena

- **Luces y cámaras.** La iluminación se define en el sitio para que los 7 modelos se vean coherentes entre sí.
- Planos de suelo, fondos, objetos auxiliares.
- Nombres genéricos (`Cube.001`, `Material.003`).

### Antes de entregar

Que validen cada archivo en **https://gltf-viewer.donmccurdy.com/** — arrastrar el `.glb` y confirmar que se ve bien y que la animación corre. Es gratis y toma segundos.

---

## Tubería de optimización (de nuestro lado)

Aun con la ficha cumplida, conviene pasar cada archivo por `gltf-transform` (CLI libre, `npx @gltf-transform/cli`):

```
gltf-transform optimize entrada.glb salida.glb \
  --compress meshopt \
  --texture-compress webp
```

- **Meshopt en vez de Draco**: decodificador de ~15 KB contra ~90 KB, y descomprime más rápido — importa en Android de gama baja.
- **Texturas a WebP**: suele recortar 40-60 % sin diferencia visible.
- KTX2/Basis solo si las texturas siguen pesando mucho: comprime más pero su decodificador añade ~200 KB, así que hay que medir si compensa.

Medir antes y después, y dejar la cifra registrada en el CHANGELOG.

---

## Integración en el sitio

### Datos (mismo patrón que el resto)

- `frontend/src/lib/data/types.ts` — añadir a `Proposal`:
  ```ts
  model?: { src: string; poster: string; alt: string };
  ```
  Opcional, para que las propuestas sin modelo sigan funcionando.
- `frontend/src/lib/data/mock/seed-data.ts` — rellenar `model` en cada propuesta.
- `frontend/src/lib/data/http/http-content-repository.ts` — mapear el campo cuando venga de la API.
- `backend/README.md` — documentar el campo en la entidad `Proposal`.

La interfaz `ContentRepository` **no cambia**: es un campo más en un tipo que ya se devuelve.

### Archivos

- Los `.glb` van en **`frontend/public/models/`**. Astro no procesa binarios 3D, así que se sirven tal cual con URL estable.
- Los pósters van en **`frontend/src/assets/models/`** para que `astro:assets` genere los WebP responsive.
- **Atención al repositorio**: 7 × 1,5 MB ≈ 10 MB de binarios en git. Decidir si se usa Git LFS antes del primer commit — después es más molesto de migrar.

### Componente

Nuevo `frontend/src/components/Model3D.astro`, con props `src`, `poster`, `alt`:

- Renderiza el póster como `<img>` normal desde el primer pintado.
- Un `IntersectionObserver` carga el script de `model-viewer` y el `.glb` solo cuando el bloque entra en pantalla.
- Se inserta en `frontend/src/pages/propuestas/[slug].astro`, donde hoy está el bloque «Contenido en preparación».

### Accesibilidad (no negociable)

El sitio tiene un panel de accesibilidad con política propia, y el CSS **no puede parar WebGL** — hay que hacerlo en JS:

- Si `document.documentElement` tiene la clase **`reduce-motion`**, no arrancar la animación (y pausarla si se activa el modo con el modelo ya cargado). Es la misma regla que ya cumplen el carrusel y la cortina de cristal.
- `alt` obligatorio y descriptivo en cada modelo.
- Controles de teclado (los trae `model-viewer`, hay que verificar que funcionan con el foco visible del sitio).
- Si el navegador informa **`Save-Data`**, no cargar el modelo: dejar el póster con un botón explícito para cargarlo.

### Diseño aprobado

Añadir un bloque 3D a las 7 páginas de detalle **cambia el diseño aprobado por el cliente**. Antes de implementar hay que llevarlo al canvas de diseño y obtener el visto bueno, como se hizo con los botones flotantes y los iconos.

---

## Verificación

1. **Peso inicial sin regresión** — con el modelo fuera de pantalla, la carga inicial de `/propuestas/<slug>/` debe seguir en ~85 KB. Es la prueba de que la carga diferida funciona. Medible con Playwright interceptando peticiones.
2. **Peso con el modelo** — medir el total real tras hacer scroll y registrarlo.
3. **Los 8 modos de accesibilidad** — con `reduce-motion` activo, la animación no corre. Ya existe un test que activa los 8 modos; extenderlo.
4. **Los 7 modelos cargan** — un test que recorra las 7 páginas y confirme que el `.glb` responde 200 y el póster se ve.
5. **`bun run build` + `bun run check` + `bunx playwright test`** → 7/7 y sin errores.
6. **Prueba en equipo real de gama baja** con red limitada (Chrome DevTools, perfil «Slow 4G» + CPU 4× más lenta). Es el escenario del votante promedio de San Lorenzo, y ninguna métrica de escritorio lo sustituye.

---

## Riesgos y decisiones abiertas

- **Que los modelos lleguen fuera de presupuesto.** Es lo más probable: los artistas 3D optimizan para render, no para web. Por eso la ficha lleva límite duro y la tubería de `gltf-transform` está en el plan, no como plan B.
- **Git LFS: decidir antes del primer commit.**
- **Los 150 KB de `model-viewer` sobre three.js a medida.** Asumidos a propósito; revisable después sin tocar nada fuera del componente.
- **Si al ver el primer modelo real el peso o el rendimiento en móvil no convencen**, el repliegue natural es video pre-renderizado (~250 KB, cero JS), que ya estaba evaluado. Se pierde la interacción, pero es un cambio contenido: mismo hueco en la página, mismo campo en los datos.
