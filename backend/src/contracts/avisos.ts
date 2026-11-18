// Lo usan el backend para armar los avisos de quien administra el sitio y el frontend para pintarlos (campana, notificación y panel).

export interface Aviso {
  clave: string;
  tipo: 'error' | 'pendiente';
  icono: 'alert' | 'location' | 'bulb';
  cantidad: number;
  texto: string;
  accion: string;
  ruta: string;
  detalle?: string;
  valor?: string;
}
