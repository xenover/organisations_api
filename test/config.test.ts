import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ZodError } from "zod";
import { loadEnvironment } from "../src/config/env.js";

describe("Environment configuration", () => {
  let directory: string;
  let root: URL;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "organisations-env-"));
    root = pathToFileURL(`${directory}/`);
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("starts with local defaults when environment files are absent", () => {
    expect(loadEnvironment(root, {})).to.deep.equal({
      NODE_ENV: "development",
      PORT: 3000,
      LOG_LEVEL: "debug",
    });
  });

  it("fails on unreadable environment files instead of falling back to defaults", () => {
    mkdirSync(join(directory, ".env"));
    expect(() => loadEnvironment(root, {})).to.throw();
  });

  it("loads the selected environment file over base values and preserves external overrides", () => {
    writeFileSync(
      join(directory, ".env"),
      "NODE_ENV=test\nPORT=4100\nLOG_LEVEL=info\n",
    );
    writeFileSync(join(directory, ".env.test"), "PORT=4200\nLOG_LEVEL=trace\n");
    expect(loadEnvironment(root, {})).to.deep.equal({
      NODE_ENV: "test",
      PORT: 4200,
      LOG_LEVEL: "trace",
    });
    const external = { PORT: "4300", LOG_LEVEL: "warn" };
    expect(loadEnvironment(root, external)).to.deep.equal({
      NODE_ENV: "test",
      PORT: 4300,
      LOG_LEVEL: "warn",
    });
    expect(external).to.deep.equal({ PORT: "4300", LOG_LEVEL: "warn" });
  });

  it("selects test mode before reading development defaults", () => {
    writeFileSync(join(directory, ".env"), "NODE_ENV=development\nPORT=4100\n");
    writeFileSync(join(directory, ".env.development"), "PORT=4200\n");
    writeFileSync(join(directory, ".env.test"), "PORT=4300\n");
    expect(loadEnvironment(root, { NODE_ENV: "test" })).to.deep.equal({
      NODE_ENV: "test",
      PORT: 4300,
      LOG_LEVEL: "silent",
    });
  });

  for (const invalid of [
    { NODE_ENV: "production" },
    { LOG_LEVEL: "verbose" },
    ...["", "-1", "1.5", "65536", "abc"].map((PORT) => ({ PORT })),
  ]) {
    it(`rejects invalid settings ${JSON.stringify(invalid)}`, () => {
      expect(() => loadEnvironment(root, invalid)).to.throw(ZodError);
    });
  }
});
