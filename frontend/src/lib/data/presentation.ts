import posterCentroAltoRendimiento from '../../assets/models/centro-de-alto-rendimiento.png';
import posterEducacion from '../../assets/models/educacion-coliseo.png';
import posterTecnologias from '../../assets/models/tecnologias-emergentes.png';
import type { ProposalModel } from './types';

export const proposalIcons: Record<string, string> = {
  'agua-potable': 'water', 'centro-de-alto-rendimiento': 'sport', 'mercado-municipal': 'market',
  'terminal-terrestre': 'bus', agronomia: 'leaf', educacion: 'book', 'tecnologias-emergentes': 'tech',
};
export const proposalModels: Record<string, ProposalModel> = {
  'centro-de-alto-rendimiento': {
    src: '/models/centro-de-alto-rendimiento.glb', poster: posterCentroAltoRendimiento,
    alt: 'Modelo 3D del Centro Deportivo de Alto Rendimiento San Lorenzo: estadio con pista atlética, coliseo con piscinas, canchas y la entrada con su letrero',
  },
  educacion: {
    src: '/models/educacion-coliseo.glb', poster: posterEducacion,
    alt: 'Modelo 3D del coliseo: edificio rectangular con techo a dos aguas y el letrero «COLISEO» en la fachada',
  },
  'tecnologias-emergentes': {
    src: '/models/tecnologias-emergentes.glb', poster: posterTecnologias,
    alt: 'Modelo 3D de cuatro paneles solares sobre una estructura de soporte metálica',
  },
};
export const citizenIcons = { sugerencias: 'idea', 'alerta-ciudadana': 'alert', chat: 'chat' };
