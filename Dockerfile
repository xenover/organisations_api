# syntax=docker/dockerfile:1
FROM node:24.21.0-bookworm-slim AS build
WORKDIR /usr/src/app
COPY package.json package-lock.json .npmrc ./
# Build SQLite for this image's libc; the optional CA is only mounted during installation.
RUN --mount=type=secret,id=proxy_ca \
    set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends python3 make g++; \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    HUSKY=0 npm_config_build_from_source=true npm ci; \
    apt-get purge -y --auto-remove python3 make g++; \
    rm -rf /var/lib/apt/lists/*
COPY tsconfig.json tsconfig.build.json server.ts knexfile.ts ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build && npm prune --omit=dev --ignore-scripts --offline --no-audit

FROM node:24.21.0-bookworm-slim AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=development PORT=3000 LOG_LEVEL=info SQLITE_FILENAME=/usr/src/app/data/dev.sqlite3
COPY --from=build --chown=node:node /usr/src/app/package.json ./
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/organisations-entrypoint
RUN mkdir data && chown node:node data
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD node --input-type=module -e 'fetch(`http://127.0.0.1:${process.env.PORT || 3000}/health`, { signal: AbortSignal.timeout(2000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'
ENTRYPOINT ["organisations-entrypoint"]
CMD ["node", "dist/server.js"]
