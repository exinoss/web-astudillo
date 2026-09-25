import { setAccountNav } from '../lib/auth/navigation';
import { authRepository } from '../lib/data/auth';
import { ApiError } from '../lib/data/http/api-client';

if (location.pathname !== '/cuenta/') {
  authRepository.getProfile()
    .then(() => setAccountNav(true))
    .catch(error => setAccountNav(error instanceof ApiError && error.status === 403));
}

const nav = document.querySelector<HTMLElement>("#main-nav")!;
const toggle = document.querySelector<HTMLButtonElement>(".menu-toggle")!;
const dropdowns = [...document.querySelectorAll<HTMLElement>(".nav-dropdown")];

/** Sincroniza el estado accesible y la visibilidad de un submenú. */
function setDropdown(el: HTMLElement, open: boolean) {
  el.querySelector("button")!.setAttribute("aria-expanded", String(open));
  el.querySelector<HTMLElement>(".dropdown-panel")!.hidden = !open;
}

/** Cierra todos los submenús de navegación abiertos. */
function closeDropdowns() {
  dropdowns.forEach((el) => setDropdown(el, false));
}

toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  nav.classList.toggle("is-open", open);
  if (!open) closeDropdowns();
});

dropdowns.forEach((el) => {
  const button = el.querySelector("button")!;
  let timer: ReturnType<typeof setTimeout>;
  const open = () => {
    clearTimeout(timer);
    closeDropdowns();
    setDropdown(el, true);
  };
  el.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse" && matchMedia("(min-width: 1200px)").matches)
      open();
  });
  el.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse")
      timer = setTimeout(() => {
        if (!el.contains(document.activeElement)) setDropdown(el, false);
      }, 180);
  });
  button.addEventListener("click", () => {
    const next = button.getAttribute("aria-expanded") !== "true";
    clearTimeout(timer);
    closeDropdowns();
    setDropdown(el, next);
  });
  button.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      open();
      el.querySelector<HTMLAnchorElement>(".dropdown-panel a")!.focus();
    }
  });
  el.addEventListener("focusout", (e) => {
    if (!el.contains(e.relatedTarget as Node)) setDropdown(el, false);
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setDropdown(el, false);
      button.focus();
      e.stopPropagation();
    }
  });
});

document.addEventListener("click", (e) => {
  if (!(e.target as Element).closest(".site-header")) {
    closeDropdowns();
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }
});

nav.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    closeDropdowns();
  }),
);

const access = document.querySelector<HTMLElement>("#access-panel")!;
const accessToggle =
  document.querySelector<HTMLButtonElement>(".access-toggle")!;

/** Abre el panel de accesibilidad y enfoca su primer control. */
const setAccess = (open: boolean) => {
  access.hidden = !open;
  accessToggle.setAttribute("aria-expanded", String(open));
  if (open) access.querySelector<HTMLButtonElement>("button")!.focus();
};

accessToggle.addEventListener("click", () => setAccess(Boolean(access.hidden)));

const backToTop = document.querySelector<HTMLButtonElement>(".back-to-top");
if (backToTop) {
  // En móvil el botón se ancla al pie por CSS (ver Layout.astro).
  const FLOTANTE = "(min-width: 1191px)";
  // Limita el margen para que el botón no se aleje del borde en monitores anchos.
  const SEPARACION_MAX = 24;
  const contenedor = document.querySelector<HTMLElement>(".site-container");

  // En páginas cortas el botón aparece sin esperar un scroll completo.
  const hayScroll = () =>
    document.documentElement.scrollHeight > window.innerHeight + 4;
  const alFinal = () =>
    window.scrollY + window.innerHeight >=
    document.documentElement.scrollHeight - 2;

  /** Ajusta visibilidad y posición del botón según scroll y ancho de página. */
  const syncBackToTop = () => {
    const flota = matchMedia(FLOTANTE).matches && contenedor !== null;
    backToTop.classList.toggle(
      "is-visible",
      !flota ||
        (hayScroll() && (window.scrollY > window.innerHeight || alFinal())),
    );
    if (!flota) {
      backToTop.style.right = "";
      return;
    }
    const margen =
      window.innerWidth - contenedor!.getBoundingClientRect().right;
    const centrado = (margen - backToTop.offsetWidth) / 2;
    backToTop.style.right =
      Math.max(6, Math.min(SEPARACION_MAX, centrado)) + "px";
  };
  window.addEventListener("scroll", syncBackToTop, { passive: true });
  window.addEventListener("resize", syncBackToTop, { passive: true });
  syncBackToTop();
  backToTop.addEventListener("click", () => {
    const suave = !document.documentElement.classList.contains("reduce-motion");
    window.scrollTo({ top: 0, behavior: suave ? "smooth" : "auto" });
  });
}

const settings = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-setting]"),
];

settings.forEach((button) => {
  const key = button.dataset.setting!;
  try {
    if (localStorage.getItem(key) === "true") {
      document.documentElement.classList.add(key);
      button.setAttribute("aria-pressed", "true");
    }
  } catch {}
  button.addEventListener("click", () => {
    const active = document.documentElement.classList.toggle(key);
    button.setAttribute("aria-pressed", String(active));
    try {
      localStorage.setItem(key, String(active));
    } catch {}
  });
});

const TEXT_MIN = 87.5,
  TEXT_MAX = 125,
  TEXT_STEP = 12.5,
  TEXT_LARGE_AT = 112.5;
let textScale = 100;
try {
  textScale = Number(localStorage.getItem("text-scale")) || 100;
} catch {}

/** Aplica el tamaño tipográfico elegido y activa sus ajustes de layout. */
function applyTextScale() {
  document.documentElement.style.fontSize =
    textScale === 100 ? "" : textScale + "%";
  document.documentElement.classList.toggle(
    "text-large",
    textScale >= TEXT_LARGE_AT,
  );
}
applyTextScale();

document
  .querySelectorAll<HTMLButtonElement>("[data-text-step]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      textScale = Math.min(
        TEXT_MAX,
        Math.max(
          TEXT_MIN,
          textScale + Number(button.dataset.textStep) * TEXT_STEP,
        ),
      );
      applyTextScale();
      try {
        localStorage.setItem("text-scale", String(textScale));
      } catch {}
    });
  });

document.querySelector(".access-reset")!.addEventListener("click", () => {
  settings.forEach((button) => {
    document.documentElement.classList.remove(button.dataset.setting!);
    button.setAttribute("aria-pressed", "false");
    try {
      localStorage.removeItem(button.dataset.setting!);
    } catch {}
  });
  textScale = 100;
  applyTextScale();
  try {
    localStorage.removeItem("text-scale");
  } catch {}
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!access.hidden) {
      setAccess(false);
      accessToggle.focus();
    }
    if (nav.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  }
});
