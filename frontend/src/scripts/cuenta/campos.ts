document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('.password-toggle');
  if (!button) return;
  const input = document.getElementById(button.dataset.target ?? '');
  if (!(input instanceof HTMLInputElement)) return;
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.textContent = visible ? 'Ocultar' : 'Mostrar';
  button.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} ${input.labels?.[0]?.textContent?.trim().toLowerCase() ?? 'contraseña'}`);
  button.setAttribute('aria-pressed', String(visible));
});
