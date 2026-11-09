export const TIPOS_DE_ALERTA = ['agua', 'basura', 'alumbrado', 'baches', 'seguridad', 'otro'] as const;
export type TipoAlerta = typeof TIPOS_DE_ALERTA[number];
export const ESTADOS_PARTICIPACION = ['recibida', 'en_revision', 'atendida'] as const;
export type EstadoParticipacion = typeof ESTADOS_PARTICIPACION[number];

export const MAX_MB_FOTO_ALERTA = 5;
export const MAX_BYTES_FOTO_ALERTA = MAX_MB_FOTO_ALERTA * 1024 * 1024;
export const MIN_DESCRIPCION_ALERTA = 10;
export const MIN_MENSAJE_SUGERENCIA = 15;
export const LARGOS_PARTICIPACION = { sector: 120, referencia: 180, descripcion: 1500, mensaje: 1500, consulta: 300 } as const;
