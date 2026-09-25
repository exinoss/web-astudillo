import { alertRepository, chatRepository, suggestionRepository } from "../lib/data";

const form = document.querySelector<HTMLFormElement>(".citizen-form");
if (form) {
  const topic = new URLSearchParams(location.search).get("tema");
  const select = form.querySelector<HTMLSelectElement>("select");
  if (
    select &&
    topic &&
    [...select.options].some((option) => option.value === topic)
  )
    select.value = topic;
  const isAlert = !!form.querySelector("#damage-photo");
  // Envía sugerencia o alerta al repositorio activo y muestra su respuesta.
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = form.querySelector<HTMLElement>(".form-status")!;
    const nombre =
      form.querySelector<HTMLInputElement>("#name")?.value.trim() || undefined;
    const mensaje = form.querySelector<HTMLTextAreaElement>("#message")!.value;
    const result = isAlert
      ? await alertRepository.submit({
          nombre,
          sector: form.querySelector<HTMLInputElement>("#topic")!.value,
          referencia:
            form.querySelector<HTMLInputElement>("#reference")?.value.trim() ||
            undefined,
          descripcion: mensaje,
          foto: form.querySelector<HTMLInputElement>("#damage-photo")
            ?.files?.[0],
        })
      : await suggestionRepository.submit({
          nombre,
          tema: form.querySelector<HTMLSelectElement>("#topic")!.value,
          mensaje,
        });
    status.hidden = false;
    status.textContent = result.message;
  });
}
const photoInput = document.querySelector<HTMLInputElement>("#damage-photo");
if (photoInput) {
  const preview = document.querySelector<HTMLElement>(".photo-preview")!;
  const picture = preview.querySelector("img")!;
  const error = document.querySelector<HTMLElement>("#photo-error")!;
  let objectUrl: string | undefined;
  /** Libera la vista previa y reinicia el control de archivo. */
  function clearPhoto() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
    photoInput!.value = "";
    preview.hidden = true;
    picture.removeAttribute("src");
    error.hidden = true;
    photoInput!.removeAttribute("aria-invalid");
  }
  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) {
      clearPhoto();
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      clearPhoto();
      error.hidden = false;
      error.textContent =
        "Selecciona una imagen JPG, PNG o WebP de hasta 10 MB.";
      photoInput.setAttribute("aria-invalid", "true");
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    error.hidden = true;
    photoInput.removeAttribute("aria-invalid");
    objectUrl = URL.createObjectURL(file);
    picture.src = objectUrl;
    preview.querySelector(".photo-name")!.textContent = file.name;
    preview.hidden = false;
  });
  picture.addEventListener("error", () => {
    clearPhoto();
    error.hidden = false;
    error.textContent = "No se pudo abrir esta imagen. Elige otra foto.";
  });
  document.querySelector(".photo-remove")!.addEventListener("click", () => {
    clearPhoto();
    photoInput.focus();
  });
  window.addEventListener("pagehide", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
}
const chatForm = document.querySelector<HTMLFormElement>("#chat-form");
if (chatForm) {
  const log = document.querySelector<HTMLElement>(".chat-messages")!;
  /** Añade el mensaje local y la respuesta del repositorio de chat. */
  const reply = async (text: string, key?: string) => {
    const user = document.createElement("div");
    user.className = "chat-message from-user";
    user.textContent = text;
    log.append(user);
    const result = await chatRepository.ask(key || text);
    const response = document.createElement("div");
    response.className = "chat-message";
    response.textContent = result.text;
    if (result.linkHref && result.linkText) {
      const link = document.createElement("a");
      link.href = result.linkHref;
      link.textContent = result.linkText;
      response.append(link);
    }
    log.append(response);
    log.scrollTop = log.scrollHeight;
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-chat]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        reply(button.textContent!, button.dataset.chat),
      ),
    );
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = chatForm.querySelector<HTMLInputElement>("input")!;
    if (input.value.trim()) reply(input.value.trim());
    input.value = "";
    input.focus();
  });
}
