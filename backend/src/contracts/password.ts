const SEQUENCES = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba'];

/** `composicion`: longitud, letra, número y símbolo; `sucesion`: 4 seguidas de abcd o 1234. El tope de 128 evita abusos al calcular el hash. */
export function passwordProblem(value: string): 'composicion' | 'sucesion' | null {
  const length = Array.from(value).length;
  if (length < 6 || length > 128 ||
    !/\p{L}/u.test(value) || !/[0-9]/.test(value) ||
    !/[^\p{L}\p{N}\s]/u.test(value)) return 'composicion';
  const normalized = value.replace(/[A-Z]/g, letter => letter.toLowerCase());
  for (let i = 0; i <= normalized.length - 4; i++) {
    if (SEQUENCES.some(sequence => sequence.includes(normalized.slice(i, i + 4)))) return 'sucesion';
  }
  return null;
}
