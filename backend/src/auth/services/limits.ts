import type { SQL } from "bun";
import { callPg } from "../../db/call";
import { ApiError } from "../../http";

const TOO_MANY = "Demasiados intentos. Espera un momento antes de volver a intentarlo";

/** Crea límites por cantidad y en memoria (registro, recuperación, Google): una ventana fija por clave. */
export function createLimiter() {
  const entries = new Map<string, { count: number; until: number }>();
  /** Cuenta intentos en una ventana fija y responde 429, con los segundos que faltan, al superar el límite. */
  const limit = (key: string, maximum: number, windowMs: number) => {
    const now = Date.now();
    if (entries.size > 10_000) for (const [name, entry] of entries) if (entry.until < now) entries.delete(name);
    const entry = entries.get(key);
    const next = !entry || entry.until < now ? { count: 1, until: now + windowMs } : { ...entry, count: entry.count + 1 };
    entries.set(key, next);
    if (next.count > maximum) throw new ApiError(429, TOO_MANY, { reintentarEn: Math.ceil((next.until - now) / 1000) });
  };
  limit.clear = (key: string) => entries.delete(key);
  return limit;
}

// ---------- Fallos de contraseña: sanción progresiva en PostgreSQL ----------

/** Fallos libres por clave antes de la primera espera; la escalada está en fn_limit_fail. */
const PAIR_FREE = 5;
const IP_FREE = 20;
/** Bloqueo mortal (3 días): el tope de la escalada. Quien llega ahí se trata como atacante. */
const MORTAL = 259_200;
/** IPs con bloqueo mortal sobre un mismo correo a partir de las cuales el dueño entra por enlace. */
export const ATTACKERS_FOR_LINK = 2;

/** Claves de un intento: la pareja correo+IP (o usuario+IP), la IP y, en el acceso, el correo. */
export type AttemptKeys = { pair: string; ip: string; email?: string };
type Row = { clave: string; espera: number; fallos: number };

/** 429 genérico con la cuenta atrás; en el primer bloqueo del acceso sugiere restablecer la contraseña. */
const blocked = (wait: number, firstBlock: boolean) =>
  new ApiError(429, TOO_MANY, { reintentarEn: wait, ...(firstBlock ? { sugerirRecuperacion: true } : {}) });

/**
 * Crea los contadores de fallos, que sobreviven a reinicios y son atómicos entre peticiones simultáneas.
 * Las esperas afectan solo a la pareja correo+IP: el dueño que se olvidó la contraseña espera y entra.
 */
export function createAttempts(sql: SQL) {
  return {
    loginKeys: (correo: string, ip: string): AttemptKeys => ({ pair: `par:${correo}|${ip}`, ip: `ip:${ip}`, email: correo }),
    changeKeys: (userId: number, ip: string): AttemptKeys => ({ pair: `cambio:${userId}|${ip}`, ip: `ip:${ip}` }),

    /**
     * Lanza 429 si la pareja o la IP están bloqueadas; se llama antes del hash para no gastar CPU.
     * Devuelve si el correo sufre un ataque desde varias IPs y el dueño debe terminar de entrar por enlace.
     */
    async check(keys: AttemptKeys, suggestRecovery = false) {
      const [rows, attackers] = await Promise.all([
        callPg<Row>(sql, "limitCheck", [[keys.pair, keys.ip].join("\n")]),
        keys.email ? callPg<{ total: number }>(sql, "limitAttackers", [keys.email]) : [],
      ]);
      const wait = Math.max(0, ...rows.map(r => r.espera));
      const pair = rows.find(r => r.clave === keys.pair);
      if (wait > 0) throw blocked(wait, suggestRecovery && pair?.fallos === PAIR_FREE + 1);
      return { emailLink: (attackers[0]?.total ?? 0) >= ATTACKERS_FOR_LINK };
    },

    /**
     * Suma un fallo en la pareja y en la IP; devuelve el 429 a lanzar si alguna quedó bloqueada.
     * Si la pareja llega al bloqueo mortal, la IP queda bloqueada también para cualquier otro correo.
     */
    async fail(keys: AttemptKeys, suggestRecovery = false) {
      const [[pair], [ip]] = await Promise.all([
        callPg<Row>(sql, "limitFail", [keys.pair, PAIR_FREE]),
        callPg<Row>(sql, "limitFail", [keys.ip, IP_FREE]),
      ]);
      if (pair.espera >= MORTAL) await callPg(sql, "limitBlock", [keys.ip, MORTAL]);
      const wait = Math.max(pair.espera, ip.espera);
      return wait > 0 ? blocked(wait, suggestRecovery && pair.fallos === PAIR_FREE + 1) : null;
    },

    /** Un acierto limpia solo su pareja: quien falla desde otra IP sigue bloqueado. */
    clear: (keys: AttemptKeys) => callPg(sql, "limitClear", [keys.pair]),
    /** Quien demuestra controlar el correo limpia sus parejas; las IPs con bloqueo mortal siguen bloqueadas. */
    clearEmail: (correo: string) => callPg(sql, "limitClearEmail", [correo]),
  };
}

// ---------- Tope de hashes simultáneos ----------

const MAX_HASHES = 8;
let hashing = 0;

/** Ejecuta un cálculo Argon2id si hay hueco; una avalancha de intentos recibe 503 en vez de agotar la CPU. */
async function hashSlot<T>(work: () => Promise<T>): Promise<T> {
  if (hashing >= MAX_HASHES) throw new ApiError(503, "El servicio está ocupado. Inténtalo en unos segundos", { reintentarEn: 5 });
  hashing++;
  try {
    return await work();
  } finally {
    hashing--;
  }
}

export const passwordHash = (password: string) => hashSlot(() => Bun.password.hash(password, "argon2id"));
export const passwordVerify = (password: string, hash: string) => hashSlot(() => Bun.password.verify(password, hash));
