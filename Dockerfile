# Debian slim: fewer npm "Exit handler never called" / musl issues than Alpine.
# Standalone output is built on glibc → run on the same family (bookworm-slim).
FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./

ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false
# Lower concurrency reduces peak RAM during install (helps small CI builders).
ENV npm_config_maxsockets=3

# Use cache mount to speed up package installation on rebuild
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund

FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# 4GB RAM limit is safer for smaller build hosts (prevents OOM)
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Remove redundant ca-certificates installation (already in slim image), only create user/group to run as non-root
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
