for (const acordeon of document.querySelectorAll<HTMLElement>(".evidencias-acordeon")) {
  const boton = acordeon.querySelector<HTMLButtonElement>(".evidencias-desplegar")!;
  boton.addEventListener("click", () => {
    const abierto = acordeon.classList.toggle("is-abierto");
    boton.setAttribute("aria-expanded", String(abierto));
  });
}
