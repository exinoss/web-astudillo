import type { ImageMetadata } from 'astro';
import type { AboutCarlosPage, AboutCarlosSlug } from '../types';

// Solo para las pruebas aisladas (`--mode test`): nunca se publican.
const images = import.meta.glob<ImageMetadata>('../../../assets/{obras,biografia}/*.png', { eager: true, import: 'default' });
const image = (path: string) => images[`../../../assets/${path}.png`];
const card = (title: string, path: string, color: 'rojo' | 'azul') => ({
  title, text: `Texto de prueba de la tarjeta «${title}».`, image: image(path), alt: `Foto de prueba: ${title}`, color, focus: { x: 50, y: 50 },
});
const video = (title: string) => ({
  title, description: 'Texto breve de prueba.', url: 'https://www.facebook.com/reel/28327883403549284/', vertical: true, cover: image('biografia/hito-1'),
});

export const aboutCarlosPages: Record<AboutCarlosSlug, AboutCarlosPage> = {
  'por-que-quiero-ser-alcalde': {
    cards: [card('Escuchar a su gente', 'obras/agua-potable-1', 'rojo'), card('Atender lo cotidiano', 'obras/educacion-1', 'rojo'),
      card('Construir juntos', 'obras/agronomia-1', 'rojo'), card('Cuidar lo de todos', 'obras/mercado-municipal-1', 'rojo')],
    video: video('Te cuento mis razones'), portrait: null, interview: [], gallery: [],
  },
  'conoce-mas': {
    cards: [card('Respeto', 'obras/agua-potable-2', 'azul'), card('Coherencia', 'obras/educacion-2', 'azul'), card('Claridad', 'obras/agronomia-2', 'azul')],
    video: video('Un mensaje de Carlos'),
    portrait: { image: image('biografia/hito-2'), alt: 'Retrato de prueba' },
    interview: [{ question: '¿Qué significa San Lorenzo para ti?', answer: 'Respuesta de prueba.' }, { question: '¿Cómo es un día tuyo?', answer: 'Otra respuesta de prueba.' }],
    gallery: ['hito-3', 'hito-4', 'hito-5', 'hito-6'].map((path, i) => ({ image: image(`biografia/${path}`), alt: `Foto de prueba ${i + 1}`, caption: `Pie de prueba ${i + 1}` })),
  },
};
