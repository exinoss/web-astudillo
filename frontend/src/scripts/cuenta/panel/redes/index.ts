import { vigilarCambios } from "../../../../lib/comun/cambios";
import { MAX_ENLACE_RED, REDES, type Red, valorWhatsapp } from "../../../../lib/comun/contenido/redes";
import { adminApi } from "../../../../lib/data/http/admin-api";
import { avisoBorrador, busy, card, field, guardarYRecargar, isPending, state } from "../ui";

const RED_LIST = Object.keys(REDES) as Red[];
/** Valor guardado de una red en el borrador. */
const guardado = (red: Red) => state.draft!.textos[REDES[red].clave] ?? "";
/** El valor guardado como se escribe en el campo: el enlace tal cual o el número con «+». */
const whatsappVisible = (valor: string) => valor.startsWith("https://") ? valor : `+${valor}`;
/** Lo que se guardaría para cada red con lo escrito ahora (WhatsApp ya como 593… o enlace); lo no válido va tal cual y la API lo explica. */
const valoresEscritos = (form: HTMLElement) => Object.fromEntries(RED_LIST.map((red) => {
  const valor = form.querySelector<HTMLInputElement>(`#red-${red}`)!.value.trim();
  return [red, red === "whatsapp" ? valorWhatsapp(valor) ?? valor : valor];
})) as Record<Red, string>;

/** Pinta el formulario de las redes sociales. */
export function renderSocial(container: HTMLElement) {
  const pendiente = RED_LIST.some((red) => isPending("Texto", REDES[red].clave));
  container.innerHTML = card("Redes sociales", `
    ${avisoBorrador(pendiente)}
    <form id="redes-form" class="flex flex-col gap-4" novalidate>
      ${field({ id: "red-facebook", label: "Facebook", value: guardado("facebook"), max: MAX_ENLACE_RED, hint: "Enlace completo de la página, empezando por https://www.facebook.com/" })}
      ${field({ id: "red-instagram", label: "Instagram (opcional)", value: guardado("instagram"), max: MAX_ENLACE_RED, hint: "Enlace completo del perfil, empezando por https://www.instagram.com/. Si lo dejas vacío, no aparece en el sitio." })}
      ${field({ id: "red-tiktok", label: "TikTok", value: guardado("tiktok"), max: MAX_ENLACE_RED, hint: "Enlace completo del perfil, empezando por https://www.tiktok.com/" })}
      ${field({ id: "red-whatsapp", label: "WhatsApp", value: whatsappVisible(guardado("whatsapp")), max: MAX_ENLACE_RED, hint: "El número (0985658595 o +593985658595) o el enlace de la comunidad (https://chat.whatsapp.com/…)." })}
      <div class="flex justify-end border-t border-t-base-300 pt-[18px]">
        <button type="submit" class="button max-tablet:w-full">Guardar borrador</button>
      </div>
    </form>`);
  const form = container.querySelector<HTMLFormElement>("#redes-form")!;
  const boton = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const base = Object.fromEntries(RED_LIST.map((red) => [red, guardado(red)]));
  vigilarCambios(form, boton, base, () => valoresEscritos(form));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const valores = valoresEscritos(form);
    // Solo se guardan las redes que cambiaron, cada una con su versión (409 si otra persona la cambió).
    const cambios = RED_LIST.filter((red) => valores[red] !== guardado(red));
    void busy(boton, () => guardarYRecargar(async () => {
      for (const red of cambios)
        // Vacío vuelve al valor de la semilla; Instagram no tiene, así que se queda sin enlace.
        await adminApi.saveText(REDES[red].clave, valores[red] || null, state.draft!.versiones.textos[REDES[red].clave] ?? null);
    }, () => renderSocial(container)));
  });
}
