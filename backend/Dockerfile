FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app
COPY package.json bun.lock ./

FROM base AS deps
RUN bun install --frozen-lockfile

FROM base AS prod_deps
RUN bun install --frozen-lockfile --production

FROM deps AS checked
COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
COPY drizzle ./drizzle
COPY database ./database
# Bun 1.3.14 en Alpine resuelve tsc desde .bin y pierde la ruta de sus imports relativos.
RUN bun ./node_modules/typescript/bin/tsc --noEmit && bun test tests/proxy.test.ts

FROM base AS runtime
COPY --from=prod_deps /app/node_modules ./node_modules
COPY --from=checked /app/src ./src
COPY drizzle ./drizzle
COPY database/fn.sql database/datains.sql ./database/
ENV NODE_ENV=production
USER bun
EXPOSE 3000
CMD ["bun", "run", "start"]

FROM nginx:1.25.5-alpine AS nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
