import { expect } from "chai";
import express from "express";
import { afterEach, beforeEach, describe, it } from "mocha";
import { once } from "node:events";
import { get } from "node:http";
import request from "supertest";
import { requestLogger } from "../src/middleware/request-logger.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { logger } from "../src/utils/logger.js";

interface LogEntry {
  level: string;
  context: Record<string, unknown>;
  message?: string;
}

describe("Request logging", () => {
  const original = {
    debug: logger.debug,
    info: logger.info,
    warn: logger.warn,
    error: logger.error,
  };
  let entries: LogEntry[];

  beforeEach(() => {
    entries = [];
    for (const level of ["debug", "info", "warn", "error"] as const) {
      logger[level] = (context: Record<string, unknown>, message?: string) => {
        entries.push({ level, context, message });
      };
    }
  });

  afterEach(() => {
    Object.assign(logger, original);
  });

  it("correlates receipt, completion, and errors without logging request payloads", async () => {
    const app = express();
    app.use(requestLogger, express.json());
    app.post("/success", (_req, res) => res.status(201).send("OK"));
    const failure = new Error("Private SQL error");
    app.post("/failure", async () => {
      throw failure;
    });
    app.use(errorHandler);

    for (const [path, statusCode] of [
      ["/success", 201],
      ["/failure", 500],
    ] as const) {
      const response = await request(app)
        .post(`${path}?private=query-secret`)
        .set("Authorization", "Bearer header-secret")
        .send({ private: "body-secret" })
        .expect(statusCode);
      const requestId = response.headers["x-request-id"];
      expect(requestId).to.match(/^[0-9a-f-]{36}$/);
      const logs = entries.filter(
        ({ context }) => context.requestId === requestId,
      );
      expect(logs.map(({ message }) => message)).to.deep.equal(
        statusCode === 500
          ? ["Request received", "Request failed", "Request completed"]
          : ["Request received", "Request completed"],
      );
      for (const { context } of logs) {
        expect(context).to.include({ requestId, method: "POST", path });
        expect(context).not.to.have.any.keys("body", "query", "headers");
      }
      const completed = logs.find(
        ({ message }) => message === "Request completed",
      )!;
      expect(completed.level).to.equal("info");
      expect(completed.context.statusCode).to.equal(statusCode);
      expect(completed.context.responseTimeMs)
        .to.be.a("number")
        .and.at.least(0);
      if (statusCode === 500) {
        const error = logs.find(({ message }) => message === "Request failed")!;
        expect(error.level).to.equal("error");
        expect(error.context.err).to.equal(failure);
        expect(failure.stack).to.include("Private SQL error");
        expect(response.text).not.to.include("Private SQL error");
      }
    }
    const serialized = JSON.stringify(entries);
    for (const secret of ["query-secret", "header-secret", "body-secret"]) {
      expect(serialized).not.to.include(secret);
    }
    expect(
      entries.filter(({ message }) => message === "Request aborted"),
    ).to.have.length(0);
  });

  it("logs a client-disconnected stream as aborted without reporting completion", async () => {
    const app = express();
    app.use(requestLogger);
    app.get("/stream", (_req, res) => res.write("Started"));
    const server = app.listen(0);
    let timeout: NodeJS.Timeout | undefined;
    try {
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing port");
      await new Promise<void>((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Abort log not received")),
          5000,
        );
        logger.warn = (context: Record<string, unknown>, message?: string) => {
          entries.push({ level: "warn", context, message });
          resolve();
        };
        const client = get(
          `http://127.0.0.1:${address.port}/stream`,
          (response) => {
            response.once("data", () => response.destroy());
          },
        );
        client.once("error", reject);
      });
      const received = entries.find(
        ({ message }) => message === "Request received",
      )!;
      const aborted = entries.find(
        ({ message }) => message === "Request aborted",
      )!;
      expect(aborted.level).to.equal("warn");
      expect(aborted.context).to.deep.equal(received.context);
      expect(
        entries.some(({ message }) => message === "Request completed"),
      ).to.equal(false);
    } finally {
      clearTimeout(timeout);
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
