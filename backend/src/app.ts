import { Elysia } from "elysia";
import type { SQL } from "bun";
import type { Config } from "./config";
import { adminRoutes } from "./admin/routes";
import { authRoutes } from "./auth/routes";
import { contentRoutes } from "./content/routes";
import { mediaFileRoutes } from "./content/routes/files";
import { previewRoutes } from "./content/routes/preview";
import { createAuthorization } from "./auth/services/authorization";
import { ApiError } from "./http";
import { mapHttpError } from "./http-errors";
import type { Mailer } from "./mailer";
import { participationRoutes } from "./participation/routes";
import { profileRoutes } from "./profile/routes";
import type { Security } from "./security";

export function createApp(deps: { sql: SQL; config: Config; mailer: Mailer; security: Security }) {
  const { sql, config, mailer, security } = deps;
  const authorization = createAuthorization(sql, security);
  return new Elysia({ normalize: false })
    // Rechaza escrituras cuyo Origin no corresponde al sitio configurado.
    .onBeforeHandle(({ request }) => {
      if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
        if (request.headers.get("origin") !== config.origin) throw new ApiError(403, "Origen no permitido");
      }
    })
    .onError(({ error, code, set }) => {
      const response = mapHttpError(error, code);
      set.status = response.status;
      if (response.detail?.reintentarEn) set.headers['retry-after'] = String(response.detail.reintentarEn);
      return { error: response.message, ...response.detail };
    })
    .get("/api/health", () => ({ ok: true }))
    .use(authRoutes(sql, config, mailer, security, authorization))
    .use(profileRoutes(sql, authorization))
    .use(adminRoutes(sql, authorization))
    .use(contentRoutes(sql, authorization, config.mediaDir))
    .use(previewRoutes(sql, config, security, authorization))
    .use(participationRoutes(sql, authorization, config.privateMediaDir))
    // En producción nginx sirve /medios desde el mismo volumen; esto solo cubre el desarrollo.
    .use(config.production ? new Elysia() : mediaFileRoutes(config.mediaDir));
}
