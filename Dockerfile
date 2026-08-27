# syntax=docker/dockerfile:1

# better-sqlite3 is a native addon, so it has to be compiled against the same
# Node ABI the runtime image uses. Two stages: build with toolchain, run without.
FROM node:22-slim AS build

WORKDIR /app

# python3/make/g++ are node-gyp's requirements for better-sqlite3.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Dependencies first: this layer is cached until package files actually change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
  # Drop dev dependencies but keep the compiled native binding.
  && npm prune --omit=dev


FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

# The bundled server, its runtime dependencies, and the built client.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Migrations are read at boot, so they ship with the image rather than the repo.
COPY --from=build /app/drizzle/migrations ./drizzle/migrations
COPY --from=build /app/package.json ./package.json

# Where the SQLite file lives. Mount a volume here or the database is lost on
# every deploy — the container filesystem is not persistent.
ENV DATABASE_URL=/data/app.db
RUN mkdir -p /data && chown -R node:node /data

USER node
EXPOSE 3000

# The platform's health check hits this; it needs no database access.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
