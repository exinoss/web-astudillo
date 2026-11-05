import { PUESTOS } from '../../../../../backend/src/contracts/equipo';
import type { Snapshot } from '../snapshot-repository';
import { fotoDePrueba } from './fotos';

// Solo para las pruebas aisladas (`--mode test`): una persona por puesto, con y sin foto, y una parroquia por caso
// (texto y fotos, solo texto, solo fotos); el resto queda vacío.
const fotos = (desde: number, cantidad: number) => Array.from({ length: cantidad }, (_, i) => ({ foto: fotoDePrueba(desde + i), alt: `Foto de prueba ${i + 1}` }));

export const miEquipo: NonNullable<Snapshot['miEquipo']> = {
  equipo: PUESTOS.map((p, i) => ({
    puesto: p.clave,
    nombre: `Persona de prueba ${i + 1}`,
    presentacion: p.clave === 'prefecto' ? 'Presentación de prueba del prefecto.' : '',
    trayectoria: p.clave === 'prefecto' ? ['Primer punto de prueba', 'Segundo punto de prueba'] : [],
    foto: i % 3 === 0 ? fotoDePrueba(41 + i) : null,
  })),
  parroquias: [
    { slug: 'alto-tambo', texto: 'Párrafo de prueba.\n\nSegundo párrafo de prueba.', fotos: fotos(51, 3) },
    { slug: 'ancon', texto: 'Texto de prueba sin fotos.', fotos: [] },
    { slug: 'calderon', texto: '', fotos: fotos(61, 3) },
  ],
};
