import { Elysia } from "elysia";
import type { SQL } from "bun";
import type { Config } from "./config";
import { authRoutes } from "./auth/routes";
import { createAuthorization } from "./auth/services/authorization";
import { ApiError } from "./http";
import type { Mailer } from "./mailer";
import { profileRoutes } from "./profile/routes";
import type { Security } from "./security";

/** Ensambla Elysia, controles HTTP y los grupos de rutas del backend. */
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
    // Expone errores controlados y oculta detalles de fallos internos.
    .onError(({ error, code, set }) => {
      if (error instanceof ApiError) {
        set.status = error.status;
        return { error: error.message };
      }
      if (code === "VALIDATION") {
        set.status = 422;
        return { error: "Datos inválidos" };
      }
      if ("errno" in error && error.errno === "23505") {
        set.status = 409;
        return { error: "La operación ya fue completada" };
      }
      console.error("Error interno", error instanceof Error ? error.message : "desconocido");
      set.status = 500;
      return { error: "Error interno" };
    })
    .get("/api/health", () => ({ ok: true }))
    .use(authRoutes(sql, config, mailer, security, authorization))
    .use(profileRoutes(sql, authorization));
}
