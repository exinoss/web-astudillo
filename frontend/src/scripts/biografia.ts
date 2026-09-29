import { sinMovimiento } from "../lib/animaciones";

const linea = document.querySelector<HTMLElement>(".linea-tiempo");
if (linea) {
  const relleno = linea.querySelector<HTMLElement>(".linea-relleno")!;
  const intro = linea.querySelector<HTMLElement>(".linea-intro")!;
  const botonIntro = intro.querySelector<HTMLButtonElement>(".linea-intro-boton")!;
  const hitos = [...linea.querySelectorAll<HTMLElement>(".hito")];

  const ocultarIntro = () => intro.classList.add("is-oculta");
  const mostrarTodos = () => hitos.forEach((hito) => hito.classList.add("is-visible"));
  const irA = (hito: HTMLElement) =>
    hito.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "start" });

  // Con «Reducir movimiento» los hitos no esperan a entrar en pantalla.
  if (sinMovimiento()) mostrarTodos();
  linea.classList.add("linea-animada");
  new MutationObserver(() => sinMovimiento() && mostrarTodos()).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ["class"] },
  );

  // rootMargin en vez de un umbral: en móvil hay hitos más altos que la pantalla.
  const alEntrar = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        entrada.target.classList.add("is-visible");
        alEntrar.unobserve(entrada.target);
      }
    },
    { rootMargin: "0px 0px -90px 0px" },
  );
  // El hito que cruza la franja central de la pantalla es el actual.
  const alCentro = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        entrada.target.classList.toggle("is-current", entrada.isIntersecting);
        // La invitación a bajar sobra cuando el primer hito ya llegó al centro.
        if (entrada.isIntersecting && entrada.target === hitos[0]) ocultarIntro();
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  hitos.forEach((hito, i) => {
    alEntrar.observe(hito);
    alCentro.observe(hito);
    hito.querySelector("button.punto")?.addEventListener("click", () => irA(hitos[i + 1]));
  });

  botonIntro.addEventListener("click", () => {
    irA(hitos[0]);
    ocultarIntro();
  });

  /** La línea empieza en el centro del botón de la intro, no atraviesa su texto. */
  function ajustarInicio() {
    const inicio = intro.offsetTop + botonIntro.offsetTop + botonIntro.offsetHeight / 2;
    linea!.style.setProperty("--inicio-linea", `${Math.round(inicio)}px`);
  }

  /** Rellena la línea según lo recorrido; el factor 130 es el de la referencia (la6.org). */
  function rellenar() {
    const caja = linea!.getBoundingClientRect();
    const recorrido = innerHeight - caja.top;
    const porcentaje = Math.max(0, Math.min(100, (recorrido / (caja.height + innerHeight)) * 130));
    relleno.style.height = `${porcentaje}%`;
  }

  addEventListener("scroll", rellenar, { passive: true });
  addEventListener("resize", () => {
    ajustarInicio();
    rellenar();
  });
  ajustarInicio();
  rellenar();
}
