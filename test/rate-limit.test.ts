import { expect } from "chai";
import express from "express";
import { describe, it } from "mocha";
import request from "supertest";
import { createPostLimiter } from "../src/middleware/post-limit.js";
import { errorHandler } from "../src/middleware/error-handler.js";

describe("POST rate limits", () => {
  it("limits POST requests, keeps reads available, and returns the common 429 envelope", async () => {
    const app = express();
    app.get("/organisations", (_req, res) => res.json([]));
    app.post("/organisations", createPostLimiter(2), (_req, res) =>
      res.status(201).type("text/plain").send("OK"),
    );
    app.use(errorHandler);
    await request(app).post("/organisations").expect(201);
    await request(app).get("/organisations").expect(200);
    await request(app).post("/organisations").expect(201);
    const limited = await request(app).post("/organisations").expect(429);
    expect(limited.body).to.deep.equal({
      error: {
        code: "RATE_LIMITED",
        message: "Too many POST requests; retry later",
        statusCode: 429,
        details: {},
      },
    });
    expect(Number(limited.headers["retry-after"])).to.be.greaterThan(0);
    expect(limited.headers.ratelimit).to.be.a("string");
    expect(limited.headers["ratelimit-policy"]).to.be.a("string");
    await request(app).get("/organisations").expect(200);
  });
});
