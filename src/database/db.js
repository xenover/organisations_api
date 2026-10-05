import knexFactory from "knex";
import configurations from "../../knexfile.js";

const env = process.env.NODE_ENV || "development";
const config = configurations[env];
const knex = knexFactory(config);

export default knex;
