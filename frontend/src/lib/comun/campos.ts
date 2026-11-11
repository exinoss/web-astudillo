export const MENSAJE_CAMPO = "m-0 mt-1.5 text-[0.75rem] leading-[1.4] text-error";
export const BOTON_MOSTRAR = "password-toggle absolute inset-y-0 right-0 min-h-11 min-w-[76px] px-3 text-[0.82rem] font-bold";
export const CAMPO_VACIO = "Completa este campo.";

type Campo = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Marca un control con su mensaje debajo (lo crea si falta) o lo desmarca con `null`; en los campos de texto, también su etiqueta. */
export function marcarError(campo: HTMLElement, mensaje: string | null) {
  if (mensaje) campo.setAttribute('aria-invalid', 'true');
  else campo.removeAttribute('aria-invalid');
  let error = document.getElementById(`${campo.id}-error`);
  if (!error && mensaje) {
    error = Object.assign(document.createElement('p'), { id: `${campo.id}-error`, className: MENSAJE_CAMPO });
    campo.after(error);
    campo.setAttribute('aria-describedby', `${campo.getAttribute('aria-describedby') ?? ''} ${error.id}`.trim());
  }
  if (error) {
    error.textContent = mensaje ?? '';
    error.hidden = !mensaje;
  }
  if (campo.matches('.campo')) (campo as Campo).labels?.forEach((l) => l.classList.toggle('text-error', !!mensaje));
}

/** Marca los campos `required` vacíos de `raiz` y lleva el foco al primer campo marcado. */
export function marcarVacios(raiz: ParentNode) {
  for (const campo of raiz.querySelectorAll<Campo>('[required]')) if (!campo.value.trim()) marcarError(campo, CAMPO_VACIO);
  raiz.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/** Desmarca un campo de `raiz` en cuanto se escribe algo en él. */
export function desmarcarAlEscribir(raiz: HTMLElement) {
  // En captura, para correr antes que la validación propia del campo (enlace del video), que puede volver a marcarlo.
  raiz.addEventListener('input', (e) => {
    const campo = e.target as Campo;
    if (campo.getAttribute('aria-invalid') === 'true' && campo.value.trim()) marcarError(campo, null);
  }, true);
}
