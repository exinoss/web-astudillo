FROM oven/bun:1.3.14-alpine AS base
# Parches de seguridad de Alpine (OpenSSL…) que la imagen de Bun aún no trae. El workflow pasa la fecha
# en PARCHES: si no cambia, la caché de Docker reutilizaría esta capa sin recoger parches nuevos.
ARG PARCHES
RUN apk upgrade --no-cache
WORKDIR /app
COPY package.json bun.lock ./

FROM base AS deps
RUN bun install --frozen-lockfile

FROM base AS prod_deps
RUN bun install --frozen-lockfile --production

FROM deps AS checked
COPY tsconfig.json ./
COPY src ./src
COPY assets ./assets
# Solo las pruebas que corren aquí: otras importan del frontend, que no está en este contexto.
COPY tests/proxy.test.ts tests/http-errors.test.ts tests/mail.test.ts ./tests/
COPY drizzle ./drizzle
COPY database ./database
# Bun 1.3.14 en Alpine resuelve tsc desde .bin y pierde la ruta de sus imports relativos.
RUN bun ./node_modules/typescript/bin/tsc --noEmit && bun test tests/proxy.test.ts tests/http-errors.test.ts tests/mail.test.ts

FROM base AS runtime
COPY --from=prod_deps /app/node_modules ./node_modules
COPY --from=checked /app/src ./src
# Imágenes incrustadas en los correos de cuenta (src/mail/plantilla.ts).
COPY assets ./assets
COPY drizzle ./drizzle
COPY database ./database
ENV NODE_ENV=production
# Carpetas de los volúmenes de fotos (públicas y privadas): si no existen con este dueño, Docker las crea como root.
RUN mkdir -p /app/medios /app/medios-privados && chown bun:bun /app/medios /app/medios-privados
USER bun
EXPOSE 3000
CMD ["bun", "run", "start"]
