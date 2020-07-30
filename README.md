# Organisations API

Simple JSON API to manage organisations and their relationships

## Technologies used

* NodeJS
* Express (HTTP)
* Knex (DB connection & queries)
* SQL Lite (DB)
* Body parser (JSON parsing)
* Nodemon (dev tool for convenience)

## APIs

* POST /organisations
** Handles organisations and their relationships creation
** Takes in a JSON body
** Outputs the same JSON body
* GET /organisations
** Handles organisations and their relationships lookup
** Parameters
*** name - string, name of the organisation
*** page - int, for pagination
** Returns JSON array of all the organisations and how they relate to the one in question

## Setup

TODO
