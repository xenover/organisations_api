# Organisations API

Simple JSON API to manage organisations and their relationships

## Technologies used

- NodeJS
- Express (HTTP)
- Knex (DB connection & queries)
- SQLite (DB)
- Body parser (JSON parsing)
- TypeScript (strict type checking)
- tsx (TypeScript development reloads)
- Mocha (testing)
- Chai (testing)

The project uses native ES modules (`import`/`export`). Local imports include
the `.js` file extension so emitted JavaScript runs directly in Node.js. Source
files use TypeScript; the historical JavaScript migration keeps its filename for
compatibility with existing migration records and is checked by TypeScript.

## APIs

- POST /organisations
  - Handles organisations and their relationships creation
  - Takes in a JSON body
  - Outputs the same JSON body
- GET /organisations
  - Handles organisations and their relationships lookup
  - Parameters
    - name - string, name of the organisation
    - page - int, for pagination
  - Returns JSON array of all the organisations and how they relate to the one in question

# Setup

## Prerequisits

- Docker installed
- Node.js 20.x (20.19+) or 22.12+ installed (npm 10+ required)
- The recommended Node.js version is pinned in `.nvmrc`. With nvm installed, run
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

## Linting and formatting

- `npm run lint` - check JavaScript and TypeScript with ESLint; warnings fail the check
- `npm run lint:fix` - apply ESLint's automatic fixes
- `npm run format` - format supported source, configuration, and documentation files
- `npm run format:check` - check formatting without changing files

`eslint.config.js` uses ESLint 9's flat configuration, recommended JavaScript
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
