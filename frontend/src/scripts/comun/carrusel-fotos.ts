import { autoavance, deslizar } from "../../lib/comun/carrusel";

for (const carrusel of document.querySelectorAll<HTMLElement>("[data-carrusel]")) {
  // Se leen en cada paso: el modo edición de la portada vuelve a pintar las diapositivas y los puntos.
  const diapositivas = () => [...carrusel.querySelectorAll<HTMLElement>("[data-diapositiva]")];
  const puntos = () => [...carrusel.querySelectorAll<HTMLButtonElement>("[data-punto]")];
  const posicion = carrusel.querySelector("[data-posicion]");
  let actual = 0;

  // El cambio automático no se anuncia: un lector de pantalla lo leería cada pocos segundos.
  const mostrar = (siguiente: number, anunciar = true) => {
    const fotos = diapositivas();
    actual = (siguiente + fotos.length) % fotos.length;
    fotos.forEach((foto, i) => (foto.hidden = i !== actual));
    puntos().forEach((punto, i) => {
      punto.classList.toggle("is-active", i === actual);
      punto.setAttribute("aria-current", String(i === actual));
    });
    if (!posicion) return;
    posicion.setAttribute("aria-live", anunciar ? "polite" : "off");
    posicion.textContent = `${actual + 1} / ${fotos.length}`;
  };

  // Como el carrusel de la portada: quieto con «Reducir movimiento» o con la pestaña oculta. Tampoco avanza
  // mientras no se ve, con el puntero o el foco del teclado encima, o con un visor abierto.
  const sincronizar = carrusel.hasAttribute("data-automatico") ? autoavance(() => {
    if (carrusel.getClientRects().length > 0 && !carrusel.matches(":hover") && !carrusel.querySelector(":focus-visible") && !document.querySelector("dialog[open]"))
      mostrar(actual + 1, false);
  }, 5000, () => diapositivas().length > 1) : () => {};
  const paso = (cuanto: number) => {
    mostrar(actual + cuanto);
    sincronizar();
  };

  carrusel.addEventListener("click", (e) => {
    const boton = (e.target as Element).closest<HTMLElement>("[data-paso], [data-punto]");
    if (!boton || !carrusel.contains(boton)) return;
    if (boton.dataset.paso) paso(Number(boton.dataset.paso));
    else paso(puntos().indexOf(boton as HTMLButtonElement) - actual);
  });

  deslizar(carrusel, (cuanto) => { if (diapositivas().length > 1) paso(cuanto); });

  document.addEventListener("carruseles:cambiados", () => {
    actual = 0;
    sincronizar();
  });
}
