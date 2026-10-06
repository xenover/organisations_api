import type { Knex } from "knex";
import { fileURLToPath } from "node:url";
import { env, projectRoot } from "./src/config/env.js";
import { resolve } from "node:path";

const databaseFile = (fallback: string) =>
  resolve(fileURLToPath(projectRoot), env.SQLITE_FILENAME ?? fallback);

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
      filename: databaseFile("dev.sqlite3"),
    },
  },
  test: {
    client: "sqlite3",
    useNullAsDefault: true,
    migrations,
    connection: {
      filename: databaseFile("test.sqlite3"),
    },
  },
};

export default configurations;
