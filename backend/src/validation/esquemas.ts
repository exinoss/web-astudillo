import { t } from 'elysia';
import { LARGOS } from '../contracts/limites';

export const strict = { additionalProperties: false };
export const pagina = t.Optional(t.Numeric({ minimum: 1, maximum: 10000 }));
export const slugText = t.String({ pattern: '^[a-z0-9-]{1,80}$' });
/** La contraseña de quien hace el cambio o el código enviado a su correo. */
export const confirmacion = t.String({ minLength: 1, maxLength: LARGOS.cuenta.contrasenia });

/** Cadena con un tope holgado: el máximo exacto y su mensaje los pone `plainText` en el servicio. */
export const text = (max: number) => t.String({ maxLength: max * 4 });

/** Admite solo uno de los valores de la lista. */
export const literals = (values: readonly string[]) => t.Union(values.map(value => t.Literal(value)));
