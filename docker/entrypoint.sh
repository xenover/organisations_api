#!/bin/sh
set -eu

# Migrate the mounted database at runtime, never bake a database into the image.
if [ "${1:-}" = "node" ] && [ "${2:-}" = "dist/server.js" ]; then
  node node_modules/knex/bin/cli.js --knexfile dist/knexfile.js migrate:latest
fi
exec "$@"
