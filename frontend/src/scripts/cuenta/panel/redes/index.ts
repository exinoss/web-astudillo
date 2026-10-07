import { vigilarCambios } from "../../../../lib/cuenta/panel/cambios";
import { normalizarWhatsapp, REDES, type Red } from "../../../../lib/comun/contenido/redes";
import { adminApi } from "../../../../lib/data/http/admin-api";
import { busy, card, DRAFT_PILL, field, isPending, notify, reloadDraft, reloadPending, state } from "../ui";

const RED_LIST = Object.keys(REDES) as Red[];
const guardado = (red: Red) => state.draft!.textos[REDES[red].clave];
/** Lo que se guardaría para cada red con lo escrito ahora (WhatsApp ya como 593…). */
const leer = (form: HTMLElement) => Object.fromEntries(RED_LIST.map((red) => {
  const valor = form.querySelector<HTMLInputElement>(`#red-${red}`)!.value.trim();
  return [red, red === "whatsapp" ? normalizarWhatsapp(valor) : valor];
})) as Record<Red, string>;

export function renderSocial(container: HTMLElement) {
  const pendiente = RED_LIST.some((red) => isPending("Texto", REDES[red].clave));
  container.innerHTML = card("Redes sociales", `
    ${pendiente ? `<p class="-mt-2 mb-5"><span class="${DRAFT_PILL}">Borrador sin publicar</span></p>` : ""}
    <form id="redes-form" class="flex flex-col gap-4" novalidate>
      ${field({ id: "red-facebook", label: "Facebook", value: guardado("facebook"), max: 300, hint: "Enlace completo de la página, empezando por https://www.facebook.com/" })}
      ${field({ id: "red-tiktok", label: "TikTok", value: guardado("tiktok"), max: 300, hint: "Enlace completo del perfil, empezando por https://www.tiktok.com/" })}
      ${field({ id: "red-whatsapp", label: "Número de WhatsApp", value: `+${guardado("whatsapp")}`, max: 20, hint: "Por ejemplo 0985658595 o +593985658595." })}
      <div class="flex justify-end border-t border-t-base-300 pt-[18px]">
        <button type="submit" class="button max-tablet:w-full">Guardar borrador</button>
      </div>
    </form>`);
  const form = container.querySelector<HTMLFormElement>("#redes-form")!;
  form.querySelector<HTMLInputElement>("#red-whatsapp")!.type = "tel";
  const boton = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const base = Object.fromEntries(RED_LIST.map((red) => [red, guardado(red)]));
  vigilarCambios(form, boton, base, () => leer(form));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const valores = leer(form);
    // Solo se guardan las redes que cambiaron, cada una con su versión (409 si otra persona la cambió).
    const cambios = RED_LIST.filter((red) => valores[red] !== guardado(red));
    void busy(boton, async () => {
      for (const red of cambios)
        await adminApi.saveText(REDES[red].clave, valores[red], state.draft!.versiones.textos[REDES[red].clave] ?? null);
      await Promise.all([reloadDraft(), reloadPending()]);
      renderSocial(container);
      notify("Enlaces guardados como borrador. Publica para que se vean en el sitio.");
    });
  });
}
