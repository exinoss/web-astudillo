/** Persona sin foto. Sin degradado propio: con varias en la página, sus `id` se repetirían. */
export const silueta = (clases: string) =>
  `<svg class="bg-linear-to-b from-neutral to-primary ${clases}" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
  `<circle cx="200" cy="190" r="78" fill="#feffff" fill-opacity=".85" />` +
  `<path d="M60 500c0-95 63-160 140-160s140 65 140 160z" fill="#feffff" fill-opacity=".85" /></svg>`;
