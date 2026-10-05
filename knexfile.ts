import type { Knex } from "knex";
import { fileURLToPath } from "node:url";
import { projectRoot } from "./src/config/env.js";

const migrations: Knex.MigratorConfig = {
  directory: fileURLToPath(new URL("./migrations/", import.meta.url)),
  loadExtensions: [".js"],
};

const configurations: Record<"development" | "test", Knex.Config> = {
  development: {
    client: "sqlite3",
    useNullAsDefault: true,
    migrations,
    connection: {
      filename: fileURLToPath(new URL("dev.sqlite3", projectRoot)),
    },
  },
  test: {
    client: "sqlite3",
    useNullAsDefault: true,
    migrations,
    connection: {
      filename: fileURLToPath(new URL("test.sqlite3", projectRoot)),
    },
  },
};

export default configurations;
