import { t } from 'elysia';

export const strict = { additionalProperties: false };
export const pagina = t.Optional(t.Numeric({ minimum: 1, maximum: 10000 }));
export const slugText = t.String({ pattern: '^[a-z0-9-]{1,80}$' });

/** Cadena con un tope holgado: el máximo exacto y su mensaje los pone `plainText` en el servicio. */
export const text = (max: number) => t.String({ maxLength: max * 4 });

/** Admite solo uno de los valores de la lista. */
export const literals = (values: readonly string[]) => t.Union(values.map(value => t.Literal(value)));
