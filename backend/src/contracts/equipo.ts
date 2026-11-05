export const GRUPOS = [
  { clave: 'prefecto', titulo: 'Prefecto' },
  { clave: 'urbanos', titulo: 'Concejales urbanos' },
  { clave: 'rurales', titulo: 'Concejales rurales' },
] as const;
export type Grupo = (typeof GRUPOS)[number]['clave'];

// Cada principal ocupa una columna con su suplente debajo (el prefecto, la del centro); la lista va en orden de lectura en celular.
export const PUESTOS = [
  { clave: 'prefecto', grupo: 'prefecto', texto: 'PREFECTO', columna: 2, fila: 1 },
  { clave: 'urbano-1', grupo: 'urbanos', texto: '1er CONCEJAL URBANO', columna: 1, fila: 1 },
  { clave: 'urbano-suplente-1', grupo: 'urbanos', texto: '1er CONCEJAL SUPLENTE', columna: 1, fila: 2 },
  { clave: 'urbano-2', grupo: 'urbanos', texto: '2do CONCEJAL URBANO', columna: 2, fila: 1 },
  { clave: 'urbano-suplente-2', grupo: 'urbanos', texto: '2do CONCEJAL SUPLENTE', columna: 2, fila: 2 },
  { clave: 'urbano-3', grupo: 'urbanos', texto: '3er CONCEJAL URBANO', columna: 3, fila: 1 },
  { clave: 'urbano-suplente-3', grupo: 'urbanos', texto: '3er CONCEJAL SUPLENTE', columna: 3, fila: 2 },
  { clave: 'rural-1', grupo: 'rurales', texto: '1er CONCEJAL RURAL', columna: 1, fila: 1 },
  { clave: 'rural-suplente-1', grupo: 'rurales', texto: '1er CONCEJAL RURAL SUPLENTE', columna: 1, fila: 2 },
  { clave: 'rural-2', grupo: 'rurales', texto: '2do CONCEJAL RURAL', columna: 2, fila: 1 },
  { clave: 'rural-suplente-2', grupo: 'rurales', texto: '2do CONCEJAL RURAL SUPLENTE', columna: 2, fila: 2 },
] as const;
export type Puesto = (typeof PUESTOS)[number]['clave'];

/** Posición del puesto en la página; -1 si no existe. */
export const ordenPuesto = (puesto: string) => PUESTOS.findIndex(p => p.clave === puesto);

export const MAX_PRESENTACION = 400;
export const MAX_TRAYECTORIA = 5;
export const MAX_PUNTO_TRAYECTORIA = 100;
