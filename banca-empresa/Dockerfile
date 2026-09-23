# syntax=docker/dockerfile:1

# ---------- Etapa 1: dependencias ----------
# Solo se reconstruye si cambian package.json / package-lock.json; el caché de npm es un cache
# mount de BuildKit compartido con las APIs (id=npm-cache)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm-cache,target=/root/.npm,sharing=locked \
    npm ci --prefer-offline --no-audit --no-fund

# ---------- Etapa 2: build ----------
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- Etapa 3: runtime (salida standalone de Next.js) ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3102 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3102
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/favicon.ico').then(()=>process.exit(0)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
