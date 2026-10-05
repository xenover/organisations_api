# Organisations API

Simple JSON API to manage organisations and their relationships

## Technologies used

* NodeJS
* Express (HTTP)
* Knex (DB connection & queries)
* SQLite (DB)
* Body parser (JSON parsing)
* TypeScript (strict type checking)
* tsx (TypeScript development reloads)
* Mocha (testing)
* Chai (testing)

The project uses native ES modules (`import`/`export`). Local imports include
the `.js` file extension so emitted JavaScript runs directly in Node.js. Source
files use TypeScript; the historical JavaScript migration keeps its filename for
compatibility with existing migration records and is checked by TypeScript.

## APIs

* POST /organisations
  * Handles organisations and their relationships creation
  * Takes in a JSON body
  * Outputs the same JSON body
* GET /organisations
  * Handles organisations and their relationships lookup
  * Parameters
    * name - string, name of the organisation
    * page - int, for pagination
  * Returns JSON array of all the organisations and how they relate to the one in question

# Setup

## Prerequisits

* Docker installed
* Node.js 20.x (20.19+) or 22.12+ installed (npm 10+ required)
* The recommended Node.js version is pinned in `.nvmrc`. With nvm installed, run
  `nvm install` and `nvm use` from the repository root.

## Build steps

* npm ci
* npm run migrate
* npm run build
* npm start

For development with automatic reloads, use `npm run dev`. It executes
`server.ts` directly. `npm start` runs the compiled `dist/server.js` after a build.

## TypeScript and database commands

* `npm run typecheck` - check application, tests, configuration, and migrations
* `npm run build` - compile application and migrations to `dist/` (excluding tests)
* `npm run migrate` - run migrations using the TypeScript configuration
* `npm run migrate:rollback` - roll back the latest batch

The build emits the Knex configuration and historical migration into `dist/`.
For a deployment using compiled files, run
`npx knex --knexfile dist/knexfile.js migrate:latest` before `npm start`.

`npm ci` installs the exact dependencies from `package-lock.json`. The `.npmrc`
configuration rejects unsupported Node.js/npm versions and makes `npm audit`
fail for high or critical vulnerabilities. Run `npm audit` to check dependencies.

## Linting

* ./node_modules/.bin/eslint .

The existing ESLint configuration checks the JavaScript migration. Run
`npm run typecheck` for TypeScript; TypeScript-aware ESLint integration is planned
in issue #73.

## Testing

* npm test (runs TypeScript tests through tsx)

## Docker setup

* docker build -t organisations_api .
* docker run -p 3000:3000 -d organisations_api

## Making requests

* using curl/postman/insomnia etc POST the JSON to http://localhost:3000/organisations
* check the results using GET http://localhost:3000/organisations?name=Black%20Banana&page=1
