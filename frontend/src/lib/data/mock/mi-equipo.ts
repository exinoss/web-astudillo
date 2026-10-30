import type { Snapshot } from '../snapshot-repository';
import { fotoDePrueba } from './fotos';

// Solo para las pruebas aisladas (`--mode test`): personas con y sin foto o «quién es», y una parroquia por caso
// (texto y fotos, solo texto, solo fotos); el resto queda vacío.
const fotos = (desde: number, cantidad: number) => Array.from({ length: cantidad }, (_, i) => ({ foto: fotoDePrueba(desde + i), alt: `Foto de prueba ${i + 1}` }));

export const miEquipo: NonNullable<Snapshot['miEquipo']> = {
  equipo: Array.from({ length: 9 }, (_, i) => ({
    nombre: `Persona de prueba ${i + 1}`, quien: i === 1 ? null : 'Concejal de prueba', foto: i % 3 === 0 ? fotoDePrueba(41 + i) : null,
  })),
  parroquias: [
    { slug: 'alto-tambo', texto: 'Párrafo de prueba.\n\nSegundo párrafo de prueba.', fotos: fotos(51, 3) },
    { slug: 'ancon', texto: 'Texto de prueba sin fotos.', fotos: [] },
    { slug: 'calderon', texto: '', fotos: fotos(61, 3) },
  ],
};
