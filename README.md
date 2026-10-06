# Organisations API

[![CI](https://github.com/xenover/organisations_api/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/xenover/organisations_api/actions/workflows/ci.yml)

A local demonstration of the original organisation relationship API, built with
Node.js 24, strict TypeScript/native ES modules, Express, Knex, and SQLite.
Operational probes, CORS, and runtime configuration demonstrate common concepts;
actual production deployment is outside the project scope.

## Quick start

Use Node.js 24 LTS and npm 10 or newer. Node **24.21.0** is pinned in `.nvmrc` and
Docker; other Node major versions are rejected by `engine-strict`. With nvm:

```sh
nvm install
nvm use
```

From a fresh checkout, install locked dependencies and start the compiled app:

```sh
npm ci
cp .env.example .env
npm run migrate
npm run build
npm start
```

The environment-file copy is optional; defaults work without it. Preserve your
existing `.env` when updating a checkout. SQLite defaults to `dev.sqlite3` in the
project root. Native SQLite installation may need Python 3, make, and a C++
compiler when a suitable prebuilt binary is unavailable.

For source reloads, stop the compiled server and run `npm run dev` after migration.
Docker is optional and only required for the [container workflow](docs/operations.md#docker-setup).

- API base: [http://localhost:3000](http://localhost:3000)
- Swagger: [http://localhost:3000/swagger](http://localhost:3000/swagger)
- OpenAPI JSON: [http://localhost:3000/swagger.json](http://localhost:3000/swagger.json)

Swagger is the canonical detailed API reference, generated from route comments
and `src/docs/openapi.ts` in both source and compiled runs. The root path returns
`Nothing here`.

## Working API examples

On a fresh database, insert a recursive hierarchy:

```sh
curl --include -H 'Content-Type: application/json' \
  --data '{"org_name":"Demo Parent","daughters":[{"org_name":"Demo Child A","daughters":[{"org_name":"Demo Grandchild"}]},{"org_name":"Demo Child B"}]}' \
  http://localhost:3000/organisations
```

POST returns **201** with the plain-text body `OK`, including for repeat
submissions. Existing names and links are reused. All recursive writes share
one transaction; a failure rolls back the request's writes.

Look up relationships by exact name:

```sh
curl --get --data-urlencode 'name=Demo Child A' --data-urlencode 'page=1' \
  http://localhost:3000/organisations
```

The response is a bare JSON array, sorted by organisation name:

```json
[
  { "org_name": "Demo Child B", "relationship_type": "sister" },
  { "org_name": "Demo Grandchild", "relationship_type": "daughter" },
  { "org_name": "Demo Parent", "relationship_type": "parent" }
]
```

GET requires one nonblank `name`; `page` is a positive integer and defaults to 1.
Each page contains up to **100** relationships. Unknown names and pages beyond
the results return `[]`; there is no pagination envelope. The query returns
immediate parents/daughters and siblings sharing a parent.

Names preserve spelling and surrounding whitespace, but must contain a nonblank
character. `daughters` may be omitted or empty, otherwise it must contain objects
following the same schema. Zod strips unknown body/query fields before database
operations. There are no ID lookup, listing, update, or delete business routes.

## Errors, request IDs, and headers

Invalid fields return 400 with field-level issues. For example:

```sh
curl --include -H 'Content-Type: application/json' \
  --data '{"org_name":""}' http://localhost:3000/organisations
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "statusCode": 400,
    "details": {
      "issues": [
        {
          "path": "body.org_name",
          "message": "Organisation name must not be blank"
        }
      ]
    }
  }
}
```

Errors use this envelope; `details` is empty unless additional safe information
is available. Malformed JSON, oversized bodies, unsupported encodings, unknown
routes, and exhausted POST budgets have stable codes documented in Swagger.
Unexpected failures return 500 with `Internal server error`, without stack
traces. Successful POST/GET response formats remain unchanged.

Each response has a generated `X-Request-ID`, shared by its request/error logs.
Pino writes JSON logs; request records omit body, header, and query values.
Recognized parser errors are sanitized in logs, while unexpected failures retain
operator diagnostics. See [logging and troubleshooting](docs/logging.md).

POST is limited to **100 requests per IP per 60 seconds**, including invalid
requests once they reach the limiter. The in-memory budget resets on restart.
A limited request returns 429 with `Retry-After` and draft 8 `RateLimit` /
`RateLimit-Policy` headers. Reads, documentation, and CORS preflight remain
available. Helmet applies security headers and removes `X-Powered-By`; HSTS and
automatic HTTPS upgrades are disabled for local HTTP.

## Commands and verification

| Command                                   | Purpose                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `npm ci`                                  | Install exact locked dependencies and local Git hooks                    |
| `npm run dev`                             | Run source with tsx reloads                                              |
| `npm run build`                           | Compile application/configuration/migrations to `dist/`, excluding tests |
| `npm start`                               | Run the compiled server after building                                   |
| `npm run migrate`                         | Apply pending migrations with source configuration                       |
| `npm run migrate:rollback`                | Roll back the latest migration batch                                     |
| `npm test`                                | Run Mocha/Chai/Supertest through tsx and exit naturally                  |
| `npm run test:watch`                      | Rerun tests in a fresh process after source/test/migration changes       |
| `npm run test:debug`                      | Pause at startup for a debugger on port 9229; test timeouts are disabled |
| `npm run test:coverage`                   | Run tests with c8 coverage and enforce thresholds                        |
| `npm run typecheck`                       | Check application, tests, configuration, and migrations                  |
| `npm run lint` / `npm run lint:fix`       | Check ESLint rules / apply automatic fixes                               |
| `npm run format:check` / `npm run format` | Check Prettier formatting / format files                                 |
| `npm audit --audit-level=high`            | Report advisories; high/critical severity fails the command              |

For debugging, attach a Node debugger (for example VS Code or Chrome's
`chrome://inspect`), set a breakpoint in a `.test.ts` file, and resume. tsx supplies
TypeScript source maps. Normal/watch/debug tests disable Node's experimental
`require(esm)` path so Mocha imports ESM consistently.

Every test process uses and removes its own temporary SQLite database. Teardown
closes Knex clients; development data and repository test files remain untouched.
Coverage includes application/configuration/migrations, even unloaded files, and
maps back to original source. Reports are `coverage/index.html`,
`coverage/lcov.info`, and `coverage/coverage-summary.json`; minimums are 95%
lines/statements/functions and 90% branches. Type declarations and generated/test
files are excluded.

GitHub Actions runs the formatting, lint, type, build, test/coverage, and
high/critical audit checks on all PRs (including stacked branches), pushes to
`master`, and manual runs, using `.nvmrc`. Coverage artifacts remain for 14 days.

## Configuration and operations

Supported configuration is limited to `NODE_ENV` (development/test), `PORT`,
`LOG_LEVEL`, `SQLITE_FILENAME`, `SHUTDOWN_TIMEOUT_MS`, and `CORS_ORIGINS`.
[Local operations](docs/operations.md) covers defaults and file precedence,
SQLite persistence, Docker/Compose, runtime injection examples, and these probes:

- `/health`: liveness independent of SQLite; 200 with `{"status":"ok"}`.
- `/ready`: required database/schema usable; 200 with `{"status":"ready"}` or
  safe 503 with `{"status":"not_ready"}`.

SIGTERM/SIGINT drain active HTTP requests, close Knex, and exit within a validated
shutdown deadline. CORS is an optional exact-origin browser policy with
credentials disabled; it is not authentication. SQLite needs no credentials;
secret-injection examples use harmless placeholders and add no secret dependency.

## Project guides

- [Architecture and database boundaries](docs/architecture.md)
- [Contributing and PR review](CONTRIBUTING.md)
- [Local configuration and containers](docs/operations.md)
- [Structured logging](docs/logging.md)

The package declares the **ISC license** in [package.json](package.json).
