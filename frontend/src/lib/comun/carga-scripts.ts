/** Añade un `<script>` a la página y resuelve al cargarse; si falla, lo quita y rechaza. */
export function cargarScript(src: string, tipo?: "module") {
  return new Promise<void>((resolver, rechazar) => {
    const script = document.createElement("script");
    if (tipo) script.type = tipo;
    script.src = src;
    script.onload = () => resolver();
    script.onerror = () => {
      script.remove();
      rechazar(new Error(`No se pudo cargar ${src}`));
    };
    document.head.append(script);
  });
}

/** Comparte una carga entre quienes la piden a la vez; si falla, la siguiente llamada la repite con otra URL. */
export function reintentable<T>(cargar: (conReintento: (url: string) => string) => Promise<T>) {
  let promesa: Promise<T> | undefined;
  let intentos = 0;
  // `?reintento=n` evita que el navegador devuelva el mismo fallo memorizado.
  const conReintento = (url: string) => (intentos ? `${url}?reintento=${intentos}` : url);
  return () => (promesa ??= cargar(conReintento).catch((error) => {
    promesa = undefined;
    intentos++;
    throw error;
  }));
}
