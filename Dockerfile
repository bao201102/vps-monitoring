# syntax=docker/dockerfile:1
# Built directly on the VPS (`docker compose up -d --build`), no registry involved.
# Debian slim: fewer npm "Exit handler never called" / musl issues than Alpine.
# Standalone output is built on glibc → run on the same family (bookworm-slim).
ARG NODE_IMAGE=node:20-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app

COPY package.json package-lock.json ./

ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    # Lower concurrency reduces peak RAM during install (helps small VPS).
    npm_config_maxsockets=3

# `npm ci` installs exactly what package-lock.json says (reproducible, faster than `npm install`).
# Cache mount keeps the npm cache on the VPS between rebuilds.
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline

FROM ${NODE_IMAGE} AS builder
WORKDIR /app

# Heap cap for `next build`; override via build arg on small VPS to avoid OOM.
ARG NODE_MAX_OLD_SPACE=2048
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=${NODE_MAX_OLD_SPACE}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output already bundles only the node_modules the server needs.
COPY --from=builder /app/public ./public
# Agent installer/script templates served by /api/install and /api/agent/script.
COPY --from=builder /app/agent ./agent
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
