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
verbosity, and `silent` disables logs.

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
disabled for this local HTTP application. Rate limiting remains optional for a
future change.

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
