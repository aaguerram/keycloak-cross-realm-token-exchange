# syntax=docker/dockerfile:1

# ---------- Etapa 1: dependencias ----------
# Esta capa solo se reconstruye si cambia package.json / package-lock.json.
# Además, el caché de npm se monta como cache mount de BuildKit (compartido entre
# servicios con id=npm-cache), así que aunque cambie el lockfile no se vuelve a
# descargar lo que ya está en caché.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm-cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --prefer-offline --no-audit --no-fund

# ---------- Etapa 2: runtime ----------
FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
