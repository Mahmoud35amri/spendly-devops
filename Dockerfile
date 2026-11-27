# syntax=docker/dockerfile:1
# Plain JavaScript, no build step, so a single stage is enough.
FROM node:24-alpine

LABEL org.opencontainers.image.source="https://github.com/Mahmoud35amri/spendly-devops" \
      org.opencontainers.image.description="Spendly expense tracker PWA + offline-first sync API" \
      org.opencontainers.image.licenses="ISC"

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/spendly.db \
    OTEL_SERVICE_NAME=spendly \
    OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=none \
    OTEL_LOGS_EXPORTER=none
WORKDIR /app

# Dependencies first, so this layer is reused until package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Only what the service needs: schema, the PWA files it serves, and the server code.
COPY schema.sql index.html styles.css app.js icons.js sw.js manifest.webmanifest ./
COPY icons ./icons
COPY server ./server

# Run as the image's unprivileged "node" user; SQLite lives on the /data volume.
RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

# Last, so a new tag does not invalidate the cached layers above. CI passes sha-<commit>.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
CMD ["node", "--require", "./server/tracing.js", "server/app.js"]
