import { Elysia, t } from "elysia";
import type { SQL } from "bun";
import type { Authorization } from "../../auth/types";
import { createProfile } from "../services/profile";

/** Expone consulta y edición limitada del perfil autenticado. */
export function profileRoutes(sql: SQL, authorization: Authorization) {
  const profile = createProfile(sql, authorization);
  return new Elysia({ prefix: "/api/me", normalize: false })
    .get("", ({ cookie }) => profile.get(cookie.access.value as string | undefined))
    .patch("", ({ body, cookie }) => profile.update(
      cookie.access.value as string | undefined, body,
    ), { body: t.Object({
      nombresCompletos: t.String({ minLength: 1, maxLength: 200 }),
      direccion: t.Optional(t.String({ maxLength: 500 })),
    }, { additionalProperties: false }) });
}
