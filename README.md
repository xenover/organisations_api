# Organisations API

[![CI](https://github.com/xenover/organisations_api/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/xenover/organisations_api/actions/workflows/ci.yml)

Simple JSON API to manage organisations and their relationships

## Technologies used

- NodeJS
- Express (HTTP and JSON parsing)
- Knex (DB connection & queries)
- SQLite (DB)
- TypeScript (strict type checking)
- tsx (TypeScript development reloads)
- Mocha (testing)
- Chai and Supertest (testing)
- dotenv (local environment files)
- Zod (configuration and request validation)
- Pino (JSON logging)
- Helmet (HTTP security headers)
- Swagger UI and swagger-jsdoc (OpenAPI documentation)
- express-rate-limit (local POST request budgets)

The project uses native ES modules (`import`/`export`). Local imports include
the `.js` file extension so emitted JavaScript runs directly in Node.js. Source
files use TypeScript; the historical JavaScript migration keeps its filename for
compatibility with existing migration records and is checked by TypeScript.

## APIs

- POST /organisations
  - Handles organisations and their relationships creation
  - Takes in a JSON body
  - Returns `201` with `OK`
- GET /organisations
  - Handles organisations and their relationships lookup
  - Parameters
    - name - required nonblank string, name of the organisation
    - page - positive integer, defaults to 1
  - Returns JSON array of all the organisations and how they relate to the one in question

Interactive Swagger documentation and examples are available at
[http://localhost:3000/swagger](http://localhost:3000/swagger); the OpenAPI document
is at [http://localhost:3000/swagger.json](http://localhost:3000/swagger.json).
Route JSDoc comments and `src/docs/openapi.ts` generate the documentation for both
source and compiled runs. The documented API retains POST's `201` with `OK`,
GET's JSON array, and pagination via `page` with 100 results per page.

Database access lives in `src/repositories/`; the organisation service coordinates
recursive insertion using one transaction for the whole POST. Existing names and
relationship links are reused. If any organisation or relationship write fails,
all writes from that request roll back, preserving previously stored data. The
relationship lookup retains its parameterized UNION query and name ordering.

# Setup

## Prerequisits

- Docker installed
- Node.js 24 LTS installed (npm 10+ required)
- Node.js 24.21.0 is pinned in `.nvmrc` and the Docker image. With nvm installed, run
  `nvm install` and `nvm use` from the repository root.

## Build steps

- npm ci
- npm run migrate
- npm run build
- npm start

For development with automatic reloads, use `npm run dev`. It executes
`server.ts` directly. `npm start` runs the compiled `dist/server.js` after a build.

## TypeScript and database commands

- `npm run typecheck` - check application, tests, configuration, and migrations
- `npm run build` - compile application and migrations to `dist/` (excluding tests)
- `npm run migrate` - run migrations using the TypeScript configuration
- `npm run migrate:rollback` - roll back the latest batch

The build emits the Knex configuration and historical migration into `dist/`.
For a deployment using compiled files, run
`npx knex --knexfile dist/knexfile.js migrate:latest` before `npm start`.

`npm ci` installs the exact dependencies from `package-lock.json`. The `.npmrc`
configuration rejects unsupported Node.js/npm versions and makes `npm audit`
fail for high or critical vulnerabilities. Run `npm audit` to check dependencies.

Express provides JSON parsing through `express.json()`; no separate application
dependency on `body-parser` is needed. Knex and SQLite3 include their own TypeScript
definitions. Mocha, Chai, and Supertest are development dependencies.

The project supports the Node.js 24 LTS line; `engines` rejects other Node.js major
versions. Node's TypeScript definitions use the same major version. TypeScript
stays on 6.0 for compatibility with typescript-eslint's supported compiler range.

## Environment configuration

Copy `.env.example` to `.env` to customize the local setup. `npm run dev`,
`npm start`, and the migration commands load these files automatically through
`src/config/env.ts`, including when using compiled files or running from another
working directory.

| Variable              | Default                                   | Accepted values                                                    |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `NODE_ENV`            | `development`                             | `development` or `test`                                            |
| `PORT`                | `3000`                                    | Integer from 0 to 65535; 0 chooses an available port               |
| `LOG_LEVEL`           | `debug` in development, `silent` in tests | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`    |
| `SHUTDOWN_TIMEOUT_MS` | `10000`                                   | Integer from 1 to 60000; bounds HTTP draining and database cleanup |

The mode is selected from the process's `NODE_ENV`, then `.env`, then the default.
Values from `.env.development` or `.env.test` override `.env`; externally supplied
environment variables take priority over both files. Missing files are optional;
invalid settings or unreadable files fail at startup. Local environment files
are excluded from Git and Docker builds; `.env.example` is the tracked template.

`npm test` selects test mode before importing application configuration and uses
an available port by default. It continues to use the separate test database.
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

## Validation, logging, and headers

Zod schemas in `src/schemas/organisations.ts` validate request bodies and queries
before database operations. Organisation names must be nonblank strings; daughters
must be an array of organisations following the same schema recursively. Names
retain their original whitespace. Query `page` must be a positive integer in
decimal notation and defaults to `1` when omitted. Unknown object keys are
discarded from the parsed body (including daughters) and query. Invalid requests
return `400` with field-level details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "statusCode": 400,
    "details": {
      "issues": [
        {
          "path": "body.daughters.0.org_name",
          "message": "Organisation name must not be blank"
        }
      ]
    }
  }
}
```

Validated values are stored in response locals, keeping Express 5's query getter
intact. Request types are inferred from the schemas.
The validation middleware carries each schema's output type into the handler's
locals, including the numeric page default and conversion. Raw request values
are left intact; handlers consume the parsed values.

`src/utils/logger.ts` exports the shared Pino logger. Logs are JSON in every mode;
the startup record includes the actual listening port. `LOG_LEVEL` controls
verbosity, and `silent` disables logs. Request middleware generates an
`X-Request-ID` for each request. It logs receipt at `debug`, completion at `info`
with method, path, HTTP status, and elapsed milliseconds, and interrupted
connections at `warn`. Error records include the same request ID. Bodies, query
values, and request headers are excluded from these request records.

## Error responses

API errors use the JSON envelope above. `details` is an empty object unless the
error supplies additional information, such as validation issues. Successful
POST and GET responses retain their existing formats.

| Code                     | HTTP status | Meaning                            |
| ------------------------ | ----------- | ---------------------------------- |
| `VALIDATION_ERROR`       | 400         | Invalid body or query fields       |
| `INVALID_JSON`           | 400         | Malformed JSON body                |
| `BAD_REQUEST`            | 400         | Aborted or incomplete request body |
| `NOT_FOUND`              | 404         | Unknown route                      |
| `CONFLICT`               | 409         | Conflicting operation              |
| `PAYLOAD_TOO_LARGE`      | 413         | JSON body exceeds the parser limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415         | Unsupported body encoding          |
| `RATE_LIMITED`           | 429         | POST request budget exceeded       |
| `INTERNAL_ERROR`         | 500         | Unexpected application failure     |

`src/errors/index.ts` defines `AppError`, `ValidationError`, `NotFoundError`,
and `ConflictError`. Their messages and details are intended for clients. Shared
codes, messages, HTTP statuses, and parser error mappings are defined in
`src/errors/definitions.ts`. The conflict class is available for future routes.

The global middleware in `src/middleware/error-handler.ts` runs after the routes
and the unknown-route fallback. Express 5 forwards rejected async handlers to
it. Unexpected failures return `Internal server error`, and parser failures use
stable messages without body excerpts. Responses omit stack traces; Pino records
the original error and stack with the method, path, status, and code. Client
errors log at `warn`, and server errors log at `error`. If a response has already
started, the middleware delegates to Express to finish handling the connection.

## Security headers

Helmet applies security headers before JSON parsing and routing, including to
error responses, and removes `X-Powered-By`. HSTS and automatic HTTPS upgrades are
disabled for this local HTTP application. Swagger UI serves assets locally and
uses the same origin as the API, so no CORS middleware is needed.

POST `/organisations` has an in-memory rate limit of 100 requests per IP in a
60-second window. GET and documentation remain available. Limited requests
receive the standard `429 RATE_LIMITED` error, `Retry-After`, and draft 8
`RateLimit` / `RateLimit-Policy` headers. The budget is local to the process and
resets on restart; invalid POST requests also consume it once they reach the
route limiter. Text successes explicitly use `text/plain`; JSON responses use
`application/json`.

## Linting and formatting

- `npm run lint` - check JavaScript and TypeScript with ESLint; warnings fail the check
- `npm run lint:fix` - apply ESLint's automatic fixes
- `npm run format` - format supported source, configuration, and documentation files
- `npm run format:check` - check formatting without changing files

`eslint.config.js` uses ESLint 10's flat configuration, recommended JavaScript
and TypeScript rules, and Node.js globals. `eslint-config-prettier` disables
formatting rules that would conflict with Prettier. Run `npm run typecheck`
separately for TypeScript's strict compiler checks.

`.prettierrc.json` sets two-space indentation, double quotes, semicolons, trailing
commas, and LF line endings. `.editorconfig` uses the same indentation and line
endings. `.prettierignore` excludes dependencies, build output, generated hook
files, the npm lockfile, and local databases.

`npm ci` installs Husky's Git hooks through the `prepare` script. Before a commit,
`.husky/pre-commit` runs lint-staged: staged JavaScript and TypeScript files receive
ESLint fixes and Prettier formatting; staged JSON, Markdown, and YAML receive
Prettier formatting. Fixes are staged automatically, and unresolved lint errors
block the commit. Only staged files are processed, preserving unstaged edits.

## Testing

- `npm test` - run Mocha/Chai/Supertest tests through tsx; exits naturally.
- `npm run test:watch` - rerun in a fresh process on source, test, or migration edits.
- `npm run test:debug` - pause at startup with Node's inspector on port 9229.
  Attach a Node debugger (for example VS Code's attach configuration or Chrome's
  `chrome://inspect`), set a breakpoint in a `.test.ts` file, and resume. Test
  timeouts are disabled while debugging; tsx provides TypeScript source maps.

Each test process uses a temporary SQLite file and removes it on exit. It does
not read or modify `dev.sqlite3` or the repository's `test.sqlite3`. The HTTP
suite constructs the Express app without starting the production listener;
Supertest owns each request's temporary server. Teardown closes both Knex clients
on successful and failed tests. Watch mode restarts the process so native ESM
modules and test data cannot carry over between runs.

`npm run test:coverage` runs the same suite with c8/V8 coverage. It writes the HTML
report to `coverage/index.html`, LCOV to `coverage/lcov.info`, and a JSON summary
to `coverage/coverage-summary.json`. Reports include application TypeScript,
server startup, Knex configuration, and migrations, including unloaded files.
Type-only interfaces, test support, dependencies, and generated output are excluded.
Coverage is remapped to original source files before exclusions are applied.

The existing 59-test suite measured 97.85% lines/statements, 97.67% functions,
and 93.13% branches before the additional behavior tests. The enforced global
minimums are 95% lines/statements/functions and 90% branches, allowing modest
headroom while detecting regressions. Critical behavior is tested explicitly:
pagination, repeated/concurrent insertion, rollback, errors, logging, and limits.

Test commands disable Node's experimental `require(esm)` path so Mocha imports
ESM tests consistently. Otherwise Mocha's require-first fallback and tsx can
load the same module twice with conflicting CommonJS/ESM source maps, producing
misleading coverage. This setting applies to normal, watch, and debug runs.

## Continuous integration

GitHub Actions runs `.github/workflows/ci.yml` for every pull request (including
PRs targeting another branch in a stack), pushes to `master`, and manual runs.
It installs locked dependencies with `npm ci` using the Node 24 version in
`.nvmrc`, then checks formatting, lint, types, build, tests/coverage, and
high/critical dependency advisories. Each failed check fails the job.

The workflow uploads the HTML, LCOV, and JSON coverage reports as a `coverage`
artifact for 14 days, including after failed tests when reports were generated.
Raw V8 temporary data is excluded. Actions use pinned commit SHAs and read-only
repository permissions. Superseded runs for the same PR or branch are canceled.
There is no release publishing or deployment workflow.

## Docker setup

- docker build -t organisations_api .
- docker run -p 3000:3000 -d organisations_api

## Making requests

- using curl/postman/insomnia etc POST the JSON to http://localhost:3000/organisations
- check the results using GET http://localhost:3000/organisations?name=Black%20Banana&page=1
