import knexModule from "knex";
import type { Knex } from "knex";
import configurations from "../../knexfile.js";
import { env } from "../config/env.js";

const config = configurations[env.NODE_ENV];
const knex: Knex = knexModule.knex(config);

export default knex;
