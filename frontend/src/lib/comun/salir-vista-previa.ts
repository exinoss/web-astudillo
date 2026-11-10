import { adminApi, PREVIEW_EXIT } from "../data/http/admin-api";

/** Si la abrió el panel (scripts/cuenta/panel/index.ts), cierra esta pestaña y vuelve a él; si no, va al panel aquí. */
export async function leaveDraftPreview() {
  const panel = window.opener as Window | null;
  if (!panel || panel.closed) return location.assign(PREVIEW_EXIT);
  await adminApi.leavePreview();
  panel.focus();
  window.close();
  // Si el navegador no deja cerrarla, al menos sale de la vista previa.
  location.assign(PREVIEW_EXIT);
}
