import { expect } from "chai";
import { describe, it } from "mocha";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

describe("Server startup", () => {
  it("starts the real listener, serves the root and docs, and logs its actual port", async () => {
    const { stdout } = await execute(
      process.execPath,
      [
        "--no-experimental-require-module",
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        `
          import assert from 'node:assert/strict';
          import { once } from 'node:events';
          const { default: server } = await import(${JSON.stringify(new URL("../server.ts", import.meta.url).href)});
          const { default: database } = await import(${JSON.stringify(new URL("../src/database/db.ts", import.meta.url).href)});
          try {
            if (!server.listening) await once(server, 'listening');
            const address = server.address();
            assert.ok(address && typeof address !== 'string');
            const base = 'http://127.0.0.1:' + address.port;
            const root = await fetch(base + '/');
            assert.equal(root.status, 200);
            assert.equal(await root.text(), 'Nothing here');
            const docs = await fetch(base + '/swagger.json');
            assert.equal(docs.status, 200);
            assert.equal((await docs.json()).openapi, '3.0.3');
          } finally {
            server.closeAllConnections();
            await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            await database.destroy();
          }
        `,
      ],
      {
        env: { ...process.env, NODE_ENV: "test", PORT: "0", LOG_LEVEL: "info" },
        timeout: 8000,
      },
    );
    const logs = stdout
      .trim()
      .split("\n")
      .map((line: string) => JSON.parse(line));
    const startup = logs.find(({ msg }) => msg === "Server started up");
    expect(startup.port).to.be.a("number").and.greaterThan(0);
    expect(
      logs.filter(({ msg }) => msg === "Request completed"),
    ).to.have.length(2);
  });
});
