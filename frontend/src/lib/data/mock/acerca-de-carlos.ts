import type { AboutCarlosPage, AboutCarlosSlug } from '../types';
import { fotoDePrueba } from './fotos';

// Solo para las pruebas aisladas (`--mode test`): nunca se publican.
const card = (title: string, foto: number, color: 'rojo' | 'azul') => ({
  title, text: `Texto de prueba de la tarjeta «${title}».`, image: fotoDePrueba(foto), alt: `Foto de prueba: ${title}`, color, focus: { x: 50, y: 50 },
});
const video = (title: string) => ({
  title, description: 'Texto breve de prueba.\n#LaNuevaHistoria', url: 'https://www.facebook.com/reel/28327883403549284/', vertical: true, cover: null,
});

export const aboutCarlosPages: Record<AboutCarlosSlug, AboutCarlosPage> = {
  'por-que-quiero-ser-alcalde': {
    cards: [card('Escuchar a su gente', 11, 'rojo'), card('Atender lo cotidiano', 12, 'rojo'),
      card('Construir juntos', 13, 'rojo'), card('Cuidar lo de todos', 14, 'rojo')],
    video: video('Te cuento mis razones'), portrait: null, interview: [], gallery: [],
  },
  'conoce-mas': {
    cards: [card('Respeto', 21, 'azul'), card('Coherencia', 22, 'azul'), card('Claridad', 23, 'azul')],
    video: video('Un mensaje de Carlos'),
    portrait: { image: fotoDePrueba(30), alt: 'Retrato de prueba' },
    interview: [{ question: '¿Qué significa San Lorenzo para ti?', answer: 'Respuesta de prueba.' }, { question: '¿Cómo es un día tuyo?', answer: 'Otra respuesta de prueba.' }],
    gallery: [31, 32, 33, 34].map((foto, i) => ({ image: fotoDePrueba(foto), alt: `Foto de prueba ${i + 1}`, caption: `Pie de prueba ${i + 1}` })),
  },
};
