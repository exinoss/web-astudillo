import { Elysia, t } from "elysia";
import type { SQL } from "bun";
import type { Authorization } from "../../auth/types";
import { createProfile } from "../services/profile";
import { LARGOS } from "../../contracts/limites";
import { access } from "../../http";
import { strict } from "../../validation/esquemas";

export function profileRoutes(sql: SQL, authorization: Authorization) {
  const profile = createProfile(sql, authorization);
  return new Elysia({ prefix: "/api/me", normalize: false })
    .get("", ({ cookie }) => profile.get(access(cookie)))
    .patch("", ({ body, cookie }) => profile.update(
      access(cookie), body,
    ), { body: t.Object({
      nombresCompletos: t.String({ minLength: 1, maxLength: LARGOS.cuenta.nombre }),
      direccion: t.Optional(t.String({ maxLength: LARGOS.cuenta.direccion })),
      versionPerfil: t.Optional(t.Integer({ minimum: 1, maximum: 2147483647 })),
    }, strict) });
}
