import { expect } from "chai";
import express from "express";
import { describe, it } from "mocha";
import request from "supertest";
import { createMutationLimiter } from "../src/middleware/mutation-limit.js";
import { errorHandler } from "../src/middleware/error-handler.js";

describe("Mutation rate limits", () => {
  it("shares a budget across mutations, keeps reads available, and returns the common 429 envelope", async () => {
    const app = express();
    const limiter = createMutationLimiter(2);
    app.get("/item", (_req, res) => res.json({ data: "read" }));
    for (const method of ["post", "patch", "delete"] as const) {
      app[method]("/item", limiter, (_req, res) =>
        res.json({ data: "changed" }),
      );
    }
    app.use(errorHandler);
    await request(app).post("/item").expect(200);
    await request(app).get("/item").expect(200);
    await request(app).patch("/item").expect(200);
    const limited = await request(app).delete("/item").expect(429);
    expect(limited.body).to.deep.equal({
      error: {
        code: "RATE_LIMITED",
        message: "Too many mutation requests; retry later",
        statusCode: 429,
        details: {},
      },
    });
    expect(Number(limited.headers["retry-after"])).to.be.greaterThan(0);
    expect(limited.headers.ratelimit).to.be.a("string");
    expect(limited.headers["ratelimit-policy"]).to.be.a("string");
    await request(app).get("/item").expect(200);
  });
});
