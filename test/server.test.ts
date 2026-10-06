import { expect } from "chai";
import { describe, it } from "mocha";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { request } from "node:http";
import { promisify } from "node:util";
import { rejects } from "node:assert/strict";

const execute = promisify(execFile);

async function startSignalFixture(
  options: {
    timeout?: number;
    failCleanup?: boolean;
    unavailableDb?: boolean;
  } = {},
) {
  const child = spawn(
    process.execPath,
    [
      "--no-experimental-require-module",
      "--import",
      "tsx",
      "--import",
      "./test/setup.ts",
      "--input-type=module",
      "--eval",
      `
      import { once } from 'node:events';
      const { default: database } = await import(${JSON.stringify(new URL("../src/database/db.ts", import.meta.url).href)});
      await database.migrate.latest();
      if (${Boolean(options.unavailableDb)}) await database.destroy();
      if (${Boolean(options.failCleanup)}) {
        const destroy = database.client.destroy.bind(database.client);
        database.client.destroy = async () => { await destroy(); throw new Error('fixture cleanup failure'); };
      }
      const { default: server } = await import(${JSON.stringify(new URL("../server.ts", import.meta.url).href)});
      server.on('request', request => {
        if (request.url === '/organisations') process.send({ type: 'request' });
      });
      if (!server.listening) await once(server, 'listening');
      process.send({ type: 'ready', port: server.address().port });
    `,
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: "0",
        LOG_LEVEL: "info",
        SHUTDOWN_TIMEOUT_MS: String(options.timeout ?? 3000),
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (data) => {
    stdout += data;
  });
  child.stderr?.on("data", (data) => {
    stderr += data;
  });
  const exit = once(child, "exit");
  const [message] = await Promise.race([
    once(child, "message"),
    exit.then(() => {
      throw new Error(`Fixture exited before startup: ${stderr}`);
    }),
  ]);
  const port = (message as { port: number }).port;
  return {
    child,
    port,
    exit,
    logs: () =>
      stdout
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
  };
}

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

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    it(`drains an in-flight POST and closes resources on ${signal}`, async () => {
      const fixture = await startSignalFixture();
      const received = once(fixture.child, "message");
      const post = request({
        hostname: "127.0.0.1",
        port: fixture.port,
        path: "/organisations",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const response = once(post, "response");
      try {
        post.write('{"org_name":"Shutdown",');
        await received;
        fixture.child.kill(signal);
        // Finish the body after shutdown starts; the existing connection must drain.
        await new Promise((resolve) => setTimeout(resolve, 100));
        await rejects(fetch(`http://127.0.0.1:${fixture.port}/health`));
        fixture.child.kill(signal);
        post.end('"daughters":[]}');
        const [reply] = await response;
        expect(reply.statusCode).to.equal(201);
        let body = "";
        reply.on("data", (chunk: Buffer) => {
          body += chunk;
        });
        await once(reply, "end");
        expect(body).to.equal("OK");
        const [code, exitSignal] = await fixture.exit;
        expect(code, JSON.stringify(fixture.logs())).to.equal(0);
        expect(exitSignal).to.equal(null);
        const shutdownLogs = fixture
          .logs()
          .filter(({ msg }) => msg.startsWith("Shutdown"));
        expect(shutdownLogs.map(({ msg }) => msg)).to.deep.equal([
          "Shutdown started",
          "Shutdown completed",
        ]);
        expect(
          shutdownLogs.every((record) => record.signal === signal),
        ).to.equal(true);
      } finally {
        post.destroy();
        if (
          fixture.child.exitCode === null &&
          fixture.child.signalCode === null
        )
          fixture.child.kill("SIGKILL");
      }
    });
  }

  it("forces a bounded failure exit when a request cannot drain", async () => {
    const fixture = await startSignalFixture({ timeout: 200 });
    const received = once(fixture.child, "message");
    const post = request({
      hostname: "127.0.0.1",
      port: fixture.port,
      path: "/organisations",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    post.on("error", () => {}); // Forced shutdown intentionally aborts this socket.
    try {
      post.write('{"org_name":"Unfinished",');
      await received;
      const started = performance.now();
      fixture.child.kill("SIGTERM");
      const [code, signal] = await fixture.exit;
      expect(code).to.equal(1);
      expect(signal).to.equal(null);
      expect(performance.now() - started).to.be.lessThan(2500);
      expect(
        fixture.logs().some(({ msg }) => msg === "Shutdown timed out"),
      ).to.equal(true);
    } finally {
      post.destroy();
      if (fixture.child.exitCode === null && fixture.child.signalCode === null)
        fixture.child.kill("SIGKILL");
    }
  });

  it("exits with failure if database cleanup rejects", async () => {
    const fixture = await startSignalFixture({ failCleanup: true });
    try {
      fixture.child.kill("SIGTERM");
      const [code] = await fixture.exit;
      expect(code).to.equal(1);
      expect(
        fixture.logs().some(({ msg }) => msg === "Shutdown failed"),
      ).to.equal(true);
    } finally {
      if (fixture.child.exitCode === null && fixture.child.signalCode === null)
        fixture.child.kill("SIGKILL");
    }
  });

  it("keeps liveness independent of an unavailable database client", async () => {
    const fixture = await startSignalFixture({ unavailableDb: true });
    try {
      const live = await fetch(`http://127.0.0.1:${fixture.port}/health`);
      expect(live.status).to.equal(200);
      expect(await live.json()).to.deep.equal({ status: "ok" });
      const ready = await fetch(`http://127.0.0.1:${fixture.port}/ready`);
      expect(ready.status).to.equal(503);
      expect(await ready.json()).to.deep.equal({ status: "not_ready" });
      fixture.child.kill("SIGINT");
      const [code] = await fixture.exit;
      expect(code, JSON.stringify(fixture.logs())).to.equal(0);
    } finally {
      if (fixture.child.exitCode === null && fixture.child.signalCode === null)
        fixture.child.kill("SIGKILL");
    }
  });
});
