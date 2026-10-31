import posterCentroAltoRendimiento from '../../assets/models/centro-de-alto-rendimiento.png';
import posterEducacion from '../../assets/models/educacion-coliseo.png';
import posterTecnologias from '../../assets/models/tecnologias-emergentes.png';
import logoMercadoLocal from '../../assets/logo-mercado-local.svg';
import type { ProposalModel, ProposalSite } from './types';

export const proposalIcons: Record<string, string> = {
  'agua-potable': 'water', 'centro-de-alto-rendimiento': 'sport', 'mercado-municipal': 'market',
  'terminal-terrestre': 'bus', agronomia: 'leaf', educacion: 'book', 'tecnologias-emergentes': 'tech',
  'mercado-local': 'bag',
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
export const proposalSites: Record<string, ProposalSite> = {
  'mercado-local': {
    url: 'https://mercado.lanuevahistoria.tech/', title: 'Mercado Local', logo: logoMercadoLocal, logoAnimado: 'mercadoLocal',
    description: 'Una vitrina para el talento, los productos y los servicios de San Lorenzo.',
  },
};
export const citizenIcons = { sugerencias: 'idea', 'alerta-ciudadana': 'alert', chat: 'chat' };
