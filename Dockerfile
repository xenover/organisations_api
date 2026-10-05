FROM node:24.21.0-slim

WORKDIR /usr/src/app

COPY package.json package-lock.json .npmrc ./

# Compile SQLite against this image's libc instead of using an incompatible prebuild.
RUN --mount=type=secret,id=proxy_ca \
    set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends python3 make g++; \
    if [ -f /run/secrets/proxy_ca ]; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; \
    fi; \
    npm_config_build_from_source=true npm ci; \
    apt-get purge -y --auto-remove python3 make g++; \
    rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm run build

RUN npx knex --knexfile dist/knexfile.js migrate:latest

EXPOSE 3000

CMD [ "node", "dist/server.js" ]
