import { expect } from "chai";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { describe, it } from "mocha";
import request from "supertest";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../src/errors/index.js";
import { errorHandler } from "../src/middleware/error-handler.js";

describe("Global error handling", () => {
  const issues = [{ path: "body.org_name", message: "Name is required" }];
  for (const scenario of [
    {
      thrown: new ValidationError(issues),
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid request",
      details: { issues },
    },
    {
      thrown: new NotFoundError(),
      statusCode: 404,
      code: "NOT_FOUND",
      message: "Route not found",
      details: {},
    },
    {
      thrown: new ConflictError("Organisation already exists"),
      statusCode: 409,
      code: "CONFLICT",
      message: "Organisation already exists",
      details: {},
    },
    {
      thrown: new AppError(
        {
          message: "Service unavailable",
          statusCode: 503,
          code: "SERVICE_UNAVAILABLE",
        },
        { retryAfterSeconds: 10 },
      ),
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Service unavailable",
      details: { retryAfterSeconds: 10 },
    },
  ]) {
    it(`returns the shared response for ${scenario.code}`, async () => {
      const app = express();
      app.get("/error", () => {
        throw scenario.thrown;
      });
      app.use(errorHandler);
      const response = await request(app)
        .get("/error")
        .expect(scenario.statusCode);
      expect(response.body).to.deep.equal({
        error: {
          code: scenario.code,
          message: scenario.message,
          statusCode: scenario.statusCode,
          details: scenario.details,
        },
      });
    });
  }

  for (const asynchronous of [false, true]) {
    it(`hides internals of ${asynchronous ? "async" : "sync"} failures`, async () => {
      const app = express();
      const failure = new Error("Private database credentials and SQL");
      if (asynchronous) {
        app.get("/error", async () => {
          await Promise.resolve();
          throw failure;
        });
      } else {
        app.get("/error", () => {
          throw failure;
        });
      }
      app.use(errorHandler);
      const response = await request(app).get("/error").expect(500);
      expect(response.body).to.deep.equal({
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
          statusCode: 500,
          details: {},
        },
      });
      expect(response.text).not.to.include(failure.message);
      expect(response.text).not.to.include("stack");
    });
  }

  it("handles exceptions that are not Error instances", async () => {
    const app = express();
    app.get("/error", async () => {
      return Promise.reject("Private failure");
    });
    app.use(errorHandler);
    const response = await request(app).get("/error").expect(500);
    expect(response.body.error).to.deep.equal({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      statusCode: 500,
      details: {},
    });
  });

  it("delegates errors after headers are sent instead of writing a second response", async () => {
    const app = express();
    const failure = new Error("Failure after response start");
    let forwarded: unknown;
    app.get("/error", (_req, res, next) => {
      res.write("Started");
      next(failure);
    });
    app.use(errorHandler);
    const finish: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
      forwarded = error;
      res.end("; delegated");
    };
    app.use(finish);
    const response = await request(app).get("/error").expect(200);
    expect(forwarded).to.equal(failure);
    expect(response.text).to.equal("Started; delegated");
  });
});
