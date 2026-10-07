for (const carrusel of document.querySelectorAll<HTMLElement>(".evidencias")) {
  const fotos = [...carrusel.querySelectorAll<HTMLElement>(".evidencia")];
  const contador = carrusel.querySelector(".evidencia-contador");
  let actual = 0;

  const mostrar = (siguiente: number) => {
    actual = (siguiente + fotos.length) % fotos.length;
    fotos.forEach((foto, i) => (foto.hidden = i !== actual));
    if (contador) contador.textContent = `${actual + 1} / ${fotos.length}`;
  };

  carrusel.querySelector(".evidencia-anterior")?.addEventListener("click", () => mostrar(actual - 1));
  carrusel.querySelector(".evidencia-siguiente")?.addEventListener("click", () => mostrar(actual + 1));

  // Deslizar en horizontal cambia de foto; el gesto vertical sigue desplazando la página.
  let inicioX = 0;
  let inicioY = 0;
  carrusel.addEventListener(
    "touchstart",
    (e) => {
      inicioX = e.changedTouches[0].clientX;
      inicioY = e.changedTouches[0].clientY;
    },
    { passive: true },
  );
  carrusel.addEventListener(
    "touchend",
    (e) => {
      const dx = e.changedTouches[0].clientX - inicioX;
      const dy = e.changedTouches[0].clientY - inicioY;
      if (fotos.length > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) mostrar(actual + (dx < 0 ? 1 : -1));
    },
    { passive: true },
  );
}

for (const acordeon of document.querySelectorAll<HTMLElement>(".evidencias-acordeon")) {
  const boton = acordeon.querySelector<HTMLButtonElement>(".evidencias-desplegar")!;
  boton.addEventListener("click", () => {
    const abierto = acordeon.classList.toggle("is-abierto");
    boton.setAttribute("aria-expanded", String(abierto));
  });
}
