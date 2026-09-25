import { ApiError } from "../../http";

/** Crea límites por clave en memoria para frenar intentos repetidos. */
export function createLimiter() {
  const entries = new Map<string, { count: number; until: number }>();
  /** Cuenta intentos en una ventana fija y responde 429 al superar el límite. */
  const limit = (key: string, maximum: number, windowMs: number) => {
    const now = Date.now();
    if (entries.size > 10_000) for (const [name, entry] of entries) if (entry.until < now) entries.delete(name);
    const entry = entries.get(key);
    const next = !entry || entry.until < now ? { count: 1, until: now + windowMs } : { ...entry, count: entry.count + 1 };
    entries.set(key, next);
    if (next.count > maximum) throw new ApiError(429, "Demasiados intentos. Prueba más tarde");
  };
  limit.clear = (key: string) => entries.delete(key);
  return limit;
}
