# Organisations API

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
- Swagger UI and swagger-jsdoc (interactive OpenAPI documentation)
- express-rate-limit (local mutation request budgets)

The project uses native ES modules (`import`/`export`). Local imports include
the `.js` file extension so emitted JavaScript runs directly in Node.js. Source
files use TypeScript; the historical JavaScript migration keeps its filename for
compatibility with existing migration records and is checked by TypeScript.

## APIs

Interactive OpenAPI documentation and examples are available at
[http://localhost:3000/swagger](http://localhost:3000/swagger). The generated
specification is at [http://localhost:3000/swagger.json](http://localhost:3000/swagger.json).
Route JSDoc comments and `src/docs/openapi.ts` generate the same document for
source and compiled runs.

| Method | Path                               | Behavior                                                   |
| ------ | ---------------------------------- | ---------------------------------------------------------- |
| POST   | `/organisations`                   | Create or merge a recursive organisation tree              |
| GET    | `/organisations?name=Child`        | Look up parent, sister, and daughter relationships by name |
| GET    | `/organisations/:id`               | Get one organisation                                       |
| PATCH  | `/organisations/:id`               | Rename an organisation with `{ "org_name": "New name" }`   |
| DELETE | `/organisations/:id`               | Delete the organisation and its relationship links         |
| GET    | `/organisations/:id/relationships` | Look up relationships by organisation ID                   |

POST reuses existing names and relationship links. It returns `201` and a
`Location` header for a new root, or `200` when merging into an existing root.
The whole tree is written in one transaction. PATCH preserves relationships and
returns `409` if another organisation already has the requested name. Only
`org_name` is accepted in PATCH; it does not edit the tree. DELETE returns `200`
with the deleted organisation; related organisations remain. Valid IDs that do
not exist return `404`. Invalid IDs and fields return `400`.

Successes use a JSON envelope, for example:

```json
{ "data": { "id": 1, "org_name": "Parent" } }
```

Relationship lists include pagination metadata:

```json
{
  "data": [{ "org_name": "Parent", "relationship_type": "parent" }],
  "pagination": { "limit": 100, "offset": 0, "total_count": 1 }
}
```

`limit` is a positive integer up to 100 (default 100); `offset` is a nonnegative
integer (default 0). The legacy `page` parameter is also supported and computes
`offset = (page - 1) * limit`. Use either `page` or `offset`; combining them returns
`400`. Relationships are sorted by name and relationship type. `total_count` counts all
matching relationships before pagination, including when the requested page is
empty. Unknown names return an empty list; unknown IDs return `404`.

These response formats replace the earlier POST `OK` text and bare GET array.
Clients should read `data` and, for lists, `pagination`.

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

| Variable    | Default                                   | Accepted values                                                 |
| ----------- | ----------------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`  | `development`                             | `development` or `test`                                         |
| `PORT`      | `3000`                                    | Integer from 0 to 65535; 0 chooses an available port            |
| `LOG_LEVEL` | `debug` in development, `silent` in tests | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent` |

The mode is selected from the process's `NODE_ENV`, then `.env`, then the default.
Values from `.env.development` or `.env.test` override `.env`; externally supplied
environment variables take priority over both files. Missing files are optional;
invalid settings or unreadable files fail at startup. Local environment files
are excluded from Git and Docker builds; `.env.example` is the tracked template.

`npm test` selects test mode before importing application configuration and uses
an available port by default. It continues to use the separate test database.
The application supports local development and testing only.

## Validation, logging, and headers

Zod schemas in `src/schemas/organisations.ts` validate request bodies and queries
before database operations. Organisation names must be nonblank strings; daughters
must be an array of organisations following the same schema recursively. Names
retain their original whitespace. Query `page` and `limit` use positive decimal integers; `offset` uses a nonnegative
decimal integer. Pagination defaults to the first 100 results. Unknown object keys are
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
values, and request headers are not included in these request records.

## Error responses

API errors use the JSON envelope above. `details` is an empty object unless the
error supplies additional information, such as validation issues.

| Code                     | HTTP status | Meaning                             |
| ------------------------ | ----------- | ----------------------------------- |
| `VALIDATION_ERROR`       | 400         | Invalid body, query, or path fields |
| `INVALID_JSON`           | 400         | Malformed JSON body                 |
| `BAD_REQUEST`            | 400         | Aborted or incomplete request body  |
| `NOT_FOUND`              | 404         | Unknown route or organisation       |
| `CONFLICT`               | 409         | Conflicting operation               |
| `PAYLOAD_TOO_LARGE`      | 413         | JSON body exceeds the parser limit  |
| `UNSUPPORTED_MEDIA_TYPE` | 415         | Unsupported body encoding           |
| `RATE_LIMITED`           | 429         | Mutation request budget exceeded    |
| `INTERNAL_ERROR`         | 500         | Unexpected application failure      |

`src/errors/index.ts` defines `AppError`, `ValidationError`, `NotFoundError`,
and `ConflictError`. Their messages and details are intended for clients. Shared
codes, messages, HTTP statuses, and parser error mappings are defined in
`src/errors/definitions.ts`. Rename collisions use the conflict class.

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

POST, PATCH, and DELETE share an in-memory rate limit of 100 requests per IP in a
60-second window. Reads and documentation remain available. Limited requests
receive the standard `429 RATE_LIMITED` error, `Retry-After`, and draft 8
`RateLimit` / `RateLimit-Policy` headers. The budget is local to the process and
resets on restart; invalid mutation requests also consume it once they reach the
route limiter.

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

- npm test (runs TypeScript tests through tsx)

## Docker setup

- docker build -t organisations_api .
- docker run -p 3000:3000 -d organisations_api

## Making requests

- using curl/postman/insomnia etc POST the JSON to http://localhost:3000/organisations
- check the results using GET http://localhost:3000/organisations?name=Black%20Banana&page=1
