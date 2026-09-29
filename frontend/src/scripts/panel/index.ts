import { mostrarCarga } from "../../lib/animaciones";
import { setAccountNav } from "../../lib/auth/navigation";
import { authRepository } from "../../lib/data/auth";
import { ApiError } from "../../lib/data/http/api-client";
import { renderBiography } from "./biografia";
import { renderWorks } from "./obras";
import { renderProposals } from "./propuestas";
import { publish, renderPublications } from "./publicaciones";
import { renderTexts } from "./textos";
import { can, notify, reloadDraft, reloadPending, state } from "./ui";
import { renderUsers } from "./usuarios";

const TABS: Record<string, { title: string; render: (section: HTMLElement) => unknown }> = {
  propuestas: { title: "Propuestas", render: renderProposals },
  biografia: { title: "Biografía", render: renderBiography },
  obras: { title: "Obras en ejecución", render: renderWorks },
  textos: { title: "Textos del sitio", render: renderTexts },
  publicaciones: { title: "Publicaciones", render: renderPublications },
  usuarios: { title: "Usuarios", render: renderUsers },
};
const ROLE_NAMES: Record<string, string> = { admin: "Admin", coadmin: "Coadmin" };

const loading = document.querySelector<HTMLElement>("#panel-cargando")!;
const tablist = document.querySelector<HTMLElement>("#panel-pestanias")!;
const tabs = [...tablist.querySelectorAll<HTMLButtonElement>("[data-pestania]")];
const publishButton = document.querySelector<HTMLButtonElement>("#panel-publicar")!;

const available = () => tabs.filter((t) => !t.hidden).map((t) => t.dataset.pestania!);

/** Muestra la pestaña pedida (o la primera disponible) y la vuelve a pintar con el borrador actual. */
function open(id: string, focus = false) {
  if (!available().includes(id)) id = available()[0];
  for (const tab of tabs) {
    const active = tab.dataset.pestania === id;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    document.querySelector<HTMLElement>(`#seccion-${tab.dataset.pestania}`)!.hidden = !active;
  }
  if (focus) tabs.find((t) => t.dataset.pestania === id)!.focus();
  document.querySelector("#panel-titulo")!.textContent = TABS[id].title;
  document.title = `${TABS[id].title} · Panel de administración · Carlos Astudillo`;
  if (location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
  void Promise.resolve(TABS[id].render(document.querySelector<HTMLElement>(`#seccion-${id}`)!))
    .catch((error) => notify(error instanceof Error ? error.message : "No se pudo cargar la sección.", true));
}

function bindTabs() {
  tabs.forEach((tab) => tab.addEventListener("click", () => open(tab.dataset.pestania!)));
  // Teclado del patrón de pestañas: flechas, Inicio y Fin (también se puede usar Tab y clic).
  tablist.addEventListener("keydown", (e) => {
    const ids = available();
    const index = ids.indexOf(tabs.find((t) => t.getAttribute("aria-selected") === "true")!.dataset.pestania!);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: ids.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    open(ids[(next + ids.length) % ids.length], true);
  });
  window.addEventListener("hashchange", () => open(location.hash.slice(1)));
  publishButton.addEventListener("click", () => {
    open("publicaciones");
    void publish(publishButton, document.querySelector<HTMLElement>("#seccion-publicaciones")!);
  });
}

async function start() {
  const done = mostrarCarga(loading, "Cargando el panel…");
  try {
    state.profile = await authRepository.getProfile();
    setAccountNav(true);
    if (!can("contenido.editar")) throw new ApiError(403, "Sin permiso");
    await Promise.all([reloadDraft(), reloadPending()]);
  } catch (error) {
    loading.hidden = true;
    // Sin sesión se va al acceso; cualquier otro rechazo se muestra con el mismo texto genérico.
    if (error instanceof ApiError && error.status === 401) return location.assign("/cuenta/");
    document.querySelector<HTMLElement>("#panel-sin-acceso")!.hidden = false;
    return;
  } finally {
    done();
  }
  loading.hidden = true;
  const role = document.querySelector<HTMLElement>("#panel-rol")!;
  role.textContent = ROLE_NAMES[state.profile.rol] ?? state.profile.rol;
  role.hidden = false;
  document.querySelector("#panel-quien")!.textContent =
    `${state.profile.nombresCompletos ?? state.profile.correo} · Los cambios se guardan como borrador hasta que publicas.`;
  publishButton.hidden = !can("contenido.publicar");
  tabs.find((t) => t.dataset.pestania === "publicaciones")!.hidden = !can("contenido.publicar");
  tabs.find((t) => t.dataset.pestania === "usuarios")!.hidden = !can("usuarios.ver");
  tablist.hidden = false;
  bindTabs();
  open(location.hash.slice(1));
}

void start();
