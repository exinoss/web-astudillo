for (const acordeon of document.querySelectorAll<HTMLElement>(".evidencias-acordeon")) {
  const boton = acordeon.querySelector<HTMLButtonElement>(".evidencias-desplegar")!;
  boton.addEventListener("click", () => {
    const abierto = acordeon.classList.toggle("is-abierto");
    boton.setAttribute("aria-expanded", String(abierto));
  });
  const carrusel = acordeon.querySelector<HTMLElement>("[data-carrusel]");
  if (!carrusel) continue;
  let ancho = 0;
  new ResizeObserver(() => {
    if (acordeon.offsetWidth === ancho) return;
    ancho = acordeon.offsetWidth;
    fijarAltoFoto(carrusel);
  }).observe(acordeon);
  void document.fonts.ready.then(() => fijarAltoFoto(carrusel));
}

/** Fija el alto de la foto al que tiene con un pie de una línea: un pie largo alarga el marco hacia abajo sin moverla. */
function fijarAltoFoto(carrusel: HTMLElement) {
  const pies = [...carrusel.querySelectorAll<HTMLElement>("figcaption")];
  carrusel.style.removeProperty("--alto-foto");
  pies.forEach((pie) => { pie.style.maxHeight = "54px"; pie.style.overflow = "hidden"; });
  const zona = carrusel.querySelector<HTMLElement>("[data-diapositiva]:not([hidden]) > div");
  if (zona?.offsetHeight) carrusel.style.setProperty("--alto-foto", `${zona.offsetHeight}px`);
  pies.forEach((pie) => { pie.style.removeProperty("max-height"); pie.style.removeProperty("overflow"); });
}
