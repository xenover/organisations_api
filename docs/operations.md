# Local operations

Configuration, probes, shutdown, and containers for this local demonstration.
For JSON log fields and troubleshooting, see [logging](logging.md).

## Environment configuration

Copy `.env.example` to `.env` to customize the local setup. `npm run dev`,
`npm start`, and the migration commands load these files automatically through
`src/config/env.ts`, including when using compiled files or running from another
working directory.

| Variable              | Default                                               | Accepted values                                                                             |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | `development`                                         | `development` or `test`                                                                     |
| `PORT`                | `3000`                                                | Integer from 0 to 65535; 0 chooses an available port                                        |
| `LOG_LEVEL`           | `debug` in development, `silent` in tests             | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`                             |
| `CORS_ORIGINS`        | Empty list                                            | Comma-separated exact HTTP(S) origins; no paths, trailing slashes, credentials, or wildcard |
| `SQLITE_FILENAME`     | `dev.sqlite3` in development, `test.sqlite3` in tests | Nonblank SQLite file path; relative paths resolve from the project root                     |
| `SHUTDOWN_TIMEOUT_MS` | `10000`                                               | Integer from 1 to 60000; bounds HTTP draining and database cleanup                          |

The mode is selected from the process's `NODE_ENV`, then `.env`, then the default.
Values from `.env.development` or `.env.test` override `.env`; externally supplied
environment variables take priority over both files. Missing files are optional;
invalid settings or unreadable files fail at startup. Local environment files
are excluded from Git and Docker builds; `.env.example` is the tracked template.

`npm test` selects test mode before importing application configuration. Its
preload overrides the test database with a temporary file, even when
`SQLITE_FILENAME` is set; startup smoke tests use an available port.
The application supports local development and testing only.

## Liveness, readiness, and shutdown

`GET /health` returns `200 {"status":"ok"}` while the HTTP app is running,
without querying SQLite. `GET /ready` reads the required columns of both
application tables and returns `200 {"status":"ready"}` if usable, or
`503 {"status":"not_ready"}` if the database or schema is unavailable. Each
query has a one-second timeout. Neither probe changes data; failure responses
contain no SQL, file paths, or internal errors. Both appear in Swagger.

On SIGTERM or SIGINT, the server stops accepting connections, drains in-flight
requests, closes Knex, and exits naturally. Repeated signals during draining are
ignored. `SHUTDOWN_TIMEOUT_MS` bounds the whole shutdown (10 seconds by default).
If the deadline expires or cleanup fails, connections are forced closed and the
process exits with status 1; forced shutdown can interrupt active work. The
server logs shutdown start, completion, failure, or timeout events.

## CORS and runtime configuration

`CORS_ORIGINS=http://localhost:5173,https://example.com` enables browser access
for those exact origins. The empty default grants no cross-origin access.
Credentials are disabled because the application has no authentication. Allowed
preflights return 204 and advertise only GET/POST and the Content-Type header;
X-Request-ID is exposed so browser code can correlate responses with logs.
Preflight runs before JSON parsing and POST rate limiting. Responses vary by
Origin so caches do not mix the policies.

Disallowed origins receive the existing HTTP response without
Access-Control-Allow-Origin. Unsupported methods/headers are not advertised,
so browsers reject those preflights. CORS governs whether browser JavaScript
can read a response; it is not authentication or authorization and does not stop
curl, other servers, or all cross-origin writes. Same-origin Swagger and requests
without Origin continue to work. See the [Express CORS documentation](https://expressjs.com/en/resources/middleware/cors/).

SQLite needs no credentials. To demonstrate runtime injection, create an environment
file outside the repository, such as `/absolute/private/organisations.env`:

```dotenv
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=info
# Harmless demonstration only; the app ignores this variable.
DEMO_SECRET=replace-with-a-local-placeholder
```

Restrict that file's permissions locally. Inject its settings without rebuilding:

```sh
docker run --name organisations_api -p 127.0.0.1:3000:3000 \
  --env-file /absolute/private/organisations.env \
  --mount source=organisations_sqlite,target=/usr/src/app/data \
  organisations_api:local
```

Alternatively, mount an environment file read-only at `/usr/src/app/.env` using
`--mount type=bind,source=/absolute/private/organisations.env,target=/usr/src/app/.env,readonly`.
Mounted files must be readable by the container user (UID 1000).
The normal file-loading rules apply; variables already set in the process/image
have priority over mounted files. `.env.container` is the optional Compose runtime
file and is excluded from Git and builds. Compose's explicit mode, port, and
storage settings take priority over that file.

Keep real values outside source, Docker build arguments, and image layers. Runtime
injection does not make values inaccessible to the local Docker operator. The app
validates only its supported settings and does not print the environment or the
unused demonstration variable. Do not paste actual values into logs or PRs.

The existing CI audit already runs `npm audit --audit-level=high`: high/critical
advisories fail the job; lower severities can be reviewed without blocking it.
Dependency updates remain reviewed changes rather than automatic fixes. Helmet,
Zod validation, parameterized queries, and the existing POST budget stay active.

## Docker setup

The multi-stage image compiles TypeScript and native SQLite in its build stage.
The runtime contains compiled files, migrations, and production dependencies;
it runs as the `node` user. Environment files, host databases, tests, coverage,
and development tools are excluded. A database is not created during the build.

```sh
docker build -t organisations_api:local .
docker volume create organisations_sqlite
docker run --name organisations_api -p 127.0.0.1:3000:3000 \
  --mount source=organisations_sqlite,target=/usr/src/app/data \
  organisations_api:local
```

The default entry point runs pending migrations against the mounted database,
then executes the compiled server directly so it receives stop signals.
`SQLITE_FILENAME` defaults to `/usr/src/app/data/dev.sqlite3` in the image. New
named volumes inherit the data directory's `node` ownership (UID/GID 1000).
Existing volumes or host bind mounts must provide writable storage with those
permissions. Custom paths require an existing writable parent directory.

The health check queries `/health` every 10 seconds with a two-second request
bound and a three-second Docker bound. It reports HTTP liveness; inspect `/ready`
separately for database readiness. The container uses port 3000 by default;
keep it nonzero when overriding it so the health check can reach it.

For an optional local Compose workflow:

```sh
docker compose up --build -d
curl http://localhost:3000/ready
docker compose logs -f api
docker compose down
```

Compose runs the compiled application, without source reloads or another database
service. `API_PORT=3100 docker compose up -d` changes the host port. Its named
SQLite volume survives container replacement and `down`; `down --volumes`
explicitly deletes the data. Optional `.env.container` supplies runtime settings
such as `LOG_LEVEL` and `SHUTDOWN_TIMEOUT_MS`; Compose fixes the internal port,
mode, and database path. Its 65-second stop grace exceeds the maximum configured
shutdown deadline. For plain Docker, use `docker stop --time 65 organisations_api`
to allow the same grace. Ports bind to `127.0.0.1` for access from the Docker
host; omitting that host address publishes on all host interfaces by default.

Run compiled migrations manually by overriding the entry point:

```sh
docker run --rm --entrypoint node \
  --mount source=organisations_sqlite,target=/usr/src/app/data \
  organisations_api:local node_modules/knex/bin/cli.js \
  --knexfile dist/knexfile.js migrate:latest
```

A local Linux amd64 verification measured a 301.5 MB image.
The HTTP readiness probe succeeded after 0.64 seconds with a fresh
volume and 0.62 seconds with an existing volume (measured after
`docker run` returned). These observations depend on the host and include pending
migrations; they are not performance targets.

Stop the API before manual rollback; substitute `migrate:rollback` for that
operation. The next normal startup reapplies pending migrations.
