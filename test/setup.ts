import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Configure tests before importing any application modules.
process.env.NODE_ENV = "test";
process.env.PORT = "0";

const directory = mkdtempSync(join(tmpdir(), "organisations-test-"));
process.once("exit", () => rmSync(directory, { recursive: true, force: true }));

// Override only this process's test configuration; development data is untouched.
const { default: configurations } = await import("../knexfile.js");
configurations.test.connection = { filename: join(directory, "test.sqlite3") };
