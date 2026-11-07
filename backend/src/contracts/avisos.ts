// Lo usan el backend para armar los avisos de quien administra el sitio y el frontend para pintarlos (campana, notificación y panel).

export interface Aviso {
  /** `video:<página>`, `alertas:<estado>` o `sugerencias:<estado>`: el panel la usa para abrir el lugar y marcarlo. */
  clave: string;
  /** `error`: algo publicado no se ve bien; también sale en la notificación al entrar y marca el panel. */
  tipo: 'error' | 'pendiente';
  icono: 'alert' | 'location' | 'bulb';
  cantidad: number;
  texto: string;
  accion: string;
  ruta: string;
  /** Motivo que el panel muestra junto al campo. */
  detalle?: string;
  /** Valor publicado que causa el aviso: el panel solo marca el campo mientras siga igual. */
  valor?: string;
}
