# Organisations API

Simple JSON API to manage organisations and their relationships

## Technologies used

* NodeJS
* Express (HTTP)
* Knex (DB connection & queries)
* SQLite (DB)
* Body parser (JSON parsing)
* Node.js watch mode (development reloads)
* Mocha (testing)
* Chai (testing)

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
* npx knex migrate:latest
* npm start

For development with automatic reloads, use `npm run dev`.

`npm ci` installs the exact dependencies from `package-lock.json`. The `.npmrc`
configuration rejects unsupported Node.js/npm versions and makes `npm audit`
fail for high or critical vulnerabilities. Run `npm audit` to check dependencies.

## Linting

* ./node_modules/.bin/eslint .

## Testing

* npm test

## Docker setup

* docker build -t organisations_api .
* docker run -p 3000:3000 -d organisations_api

## Making requests

* using curl/postman/insomnia etc POST the JSON to http://localhost:3000/organisations
* check the results using GET http://localhost:3000/organisations?name=Black%20Banana&page=1
