# Organisations API

Simple JSON API to manage organisations and their relationships

## Technologies used

* NodeJS
* Express (HTTP)
* Knex (DB connection & queries)
* SQLite (DB)
* Body parser (JSON parsing)
* Nodemon (dev tool for convenience)

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
* NodeJS installed

## Build steps

* npm install
* npx knex migrate:latest
* npm start

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
