// La franja (components/comun/DraftPreviewBar.astro) solo existe en la compilación de la vista previa.
export const inDraftPreview = () => Boolean(document.querySelector("[data-franja-vista-previa]"));

const EXIT = "/api/vista-previa/salir";

/** Si la abrió el panel (scripts/cuenta/panel/index.ts), cierra esta pestaña y vuelve a él; si no, va al panel aquí. */
export async function leaveDraftPreview() {
  const panel = window.opener as Window | null;
  if (!panel || panel.closed) return location.assign(EXIT);
  await fetch(EXIT, { redirect: "manual", credentials: "same-origin" }).catch(() => {});
  panel.focus();
  window.close();
  // Si el navegador no deja cerrarla, al menos sale de la vista previa.
  location.assign(EXIT);
}
