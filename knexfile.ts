import type { Knex } from "knex";
import { fileURLToPath } from "node:url";

// Knex changes cwd to the config's directory; source and build must share a database.
const projectRoot = new URL(
  import.meta.url.endsWith(".ts") ? "./" : "../",
  import.meta.url,
);

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
