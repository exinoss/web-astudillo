export interface Config {
  databaseUrl: string;
  origin: string;
  jwtSecret: string;
  googleClientId: string;
  port: number;
  bindHost: string;
  trustProxyIp: boolean;
  production: boolean;
  smtp: { host: string; port: number; user: string; pass: string; from: string; name: string };
}

/** Lee y valida la configuración obligatoria antes de iniciar el servidor. */
export function loadConfig(env = process.env): Config {
  const required = (key: string) => {
    const value = env[key]?.trim();
    if (!value) throw new Error(`Falta ${key}`);
    return value;
  };
  const origin = new URL(required("APP_ORIGIN")).origin;
  const production = env.NODE_ENV === "production";
  if (production && !origin.startsWith("https://")) throw new Error("APP_ORIGIN requiere HTTPS");
  const jwtSecret = required("JWT_SECRET");
  if (jwtSecret.length < 32) throw new Error("JWT_SECRET debe tener al menos 32 caracteres aleatorios");
  const smtpPort = Number(required("SMTP_PORT"));
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error("SMTP_PORT inválido");
  const port = Number(env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT inválido");
  const bindHost = env.BIND_HOST ?? "127.0.0.1";
  if (bindHost !== "127.0.0.1" && bindHost !== "0.0.0.0") throw new Error("BIND_HOST inválido");
  const proxyOption = env.TRUST_PROXY_IP ?? "false";
  if (proxyOption !== "true" && proxyOption !== "false") throw new Error("TRUST_PROXY_IP inválido");
  return {
    databaseUrl: required("DATABASE_URL"),
    origin, jwtSecret, googleClientId: required("GOOGLE_CLIENT_ID"), port,
    bindHost, trustProxyIp: proxyOption === "true", production,
    smtp: {
      host: required("SMTP_HOST"), port: smtpPort, user: required("SMTP_USER"),
      pass: required("SMTP_PASS"), from: required("SMTP_FROM"),
      name: required("SMTP_FROM_NAME"),
    },
  };
}
