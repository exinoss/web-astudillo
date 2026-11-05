// Encuadre compartido por el visor (Model3D.astro) y el generador de pósters:
// si difieren, el paso de póster a 3D da un salto visible.
export const ORBITA = "35deg 70deg auto";
export const ANCHO_POSTER = 1600;
export const ALTO_POSTER = 1000; // 16:10, la proporción del visor

// Predios grandes: encuadre más cercano y se pueden recorrer (recorrido.ts).
export const ORBITA_RECORRIDO = "35deg 60deg 75%";
export const MODELOS_RECORRIBLES = ["/models/centro-de-alto-rendimiento.glb"];
