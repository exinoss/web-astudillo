import type { AceptacionLegal } from '../../legal/legal';

export function acceptanceOf(form: HTMLFormElement): AceptacionLegal | undefined {
  const checkbox = form.querySelector<HTMLInputElement>('input[name="aceptacion"]');
  if (!checkbox?.checked) return;
  return { version: form.querySelector<HTMLElement>('[data-aceptacion]')?.dataset.version ?? '', aceptada: true };
}
