import type { AboutCarlosPage, AboutCarlosSlug } from '../types';
import { fotoDePrueba } from './fotos';

// Solo para las pruebas aisladas (`--mode test`): nunca se publican.
const video = (title: string) => ({
  title, description: 'Texto breve de prueba.\n#LaNuevaHistoria', url: 'https://www.facebook.com/reel/28327883403549284/', vertical: true, cover: null,
});

export const aboutCarlosPages: Record<AboutCarlosSlug, AboutCarlosPage> = {
  'por-que-quiero-ser-alcalde': {
    videos: [video('Te cuento mis razones'), { ...video('El agua potable para los barrios altos'), url: 'https://www.youtube.com/watch?v=abc12345678', vertical: false, medium: 'Bambero TV' },
      { ...video('Un día de recorrido con Carlos'), url: 'https://www.tiktok.com/@carlosastudillo01/video/7400000000000000000', medium: 'Voces del Norte' }], interview: [], gallery: [],
  },
  'conoce-mas': {
    videos: [video('Un mensaje de Carlos')],
    interview: [{ question: '¿Qué significa San Lorenzo para ti?', answer: 'Respuesta de prueba.' }, { question: '¿Cómo es un día tuyo?', answer: 'Otra respuesta de prueba.' }],
    gallery: [31, 32, 33, 34].map((foto, i) => ({ image: fotoDePrueba(foto), alt: `Foto de prueba ${i + 1}`, caption: `Pie de prueba ${i + 1}` })),
  },
};
