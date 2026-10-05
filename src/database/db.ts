import knexModule from "knex";
import type { Knex } from "knex";
import configurations from "../../knexfile.js";

const env = process.env.NODE_ENV || "development";
if (env !== "development" && env !== "production" && env !== "test") {
	throw new Error(`Unsupported database environment: ${env}`);
}
const config = configurations[env];
const knex: Knex = knexModule.knex(config);

export default knex;
