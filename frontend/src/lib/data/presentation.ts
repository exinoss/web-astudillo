import posterTecnologias from '../../assets/models/tecnologias-emergentes.png';
import type { ProposalModel } from './types';

export const proposalIcons: Record<string, string> = {
  'agua-potable': 'water', 'centro-de-alto-rendimiento': 'sport', 'mercado-municipal': 'market',
  'terminal-terrestre': 'bus', agronomia: 'leaf', educacion: 'book', 'tecnologias-emergentes': 'tech',
};
export const proposalModels: Record<string, ProposalModel> = {
  'tecnologias-emergentes': {
    src: '/models/tecnologias-emergentes.glb', poster: posterTecnologias,
    alt: 'Modelo 3D de cuatro paneles solares sobre una estructura de soporte metálica',
  },
};
export const citizenIcons = { sugerencias: 'idea', 'alerta-ciudadana': 'alert', chat: 'chat' };
