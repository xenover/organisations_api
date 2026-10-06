import { expect } from "chai";
import { describe, it } from "mocha";
import request from "supertest";
import createApp from "../src/app.js";

const origin = "http://localhost:5173";

describe("CORS browser policy", () => {
  it("allows exact configured origins and exposes request IDs without credentials", async () => {
    const response = await request(
      createApp({ corsOrigins: [origin, "https://example.com"] }),
    )
      .get("/health")
      .set("Origin", origin)
      .expect(200);
    expect(response.headers["access-control-allow-origin"]).to.equal(origin);
    expect(response.headers["access-control-expose-headers"]).to.equal(
      "X-Request-ID",
    );
    expect(response.headers).not.to.have.property(
      "access-control-allow-credentials",
    );
    expect(response.headers.vary).to.include("Origin");
    expect(response.headers["x-request-id"]).to.be.a("string");
  });

  for (const disallowed of [
    "https://other.example",
    "http://localhost:51730",
    "null",
  ]) {
    it(`omits browser access headers for ${disallowed} while keeping the existing response`, async () => {
      const response = await request(createApp({ corsOrigins: [origin] }))
        .get("/")
        .set("Origin", disallowed)
        .expect(200, "Nothing here");
      expect(response.headers).not.to.have.property(
        "access-control-allow-origin",
      );
      expect(response.headers.vary).to.include("Origin");
    });
  }

  it("preserves same-origin/non-browser requests and disables cross-origin access with an empty list", async () => {
    const app = createApp({ corsOrigins: [] });
    const normal = await request(app).get("/").expect(200, "Nothing here");
    const crossOrigin = await request(app)
      .get("/")
      .set("Origin", origin)
      .expect(200, "Nothing here");
    for (const response of [normal, crossOrigin])
      expect(response.headers).not.to.have.property(
        "access-control-allow-origin",
      );
    await request(app).get("/swagger/").expect(200);
  });

  it("handles JSON POST preflight before parsing/limiting and advertises only needed methods and headers", async () => {
    const app = createApp({ corsOrigins: [origin] });
    const preflight = await request(app)
      .options("/organisations")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type")
      .expect(204);
    expect(preflight.headers["access-control-allow-origin"]).to.equal(origin);
    expect(preflight.headers["access-control-allow-methods"]).to.equal(
      "GET,POST",
    );
    expect(preflight.headers["access-control-allow-headers"]).to.equal(
      "Content-Type",
    );
    expect(preflight.headers).not.to.have.property(
      "access-control-allow-credentials",
    );
    expect(preflight.headers["x-content-type-options"]).to.equal("nosniff");
    for (let i = 0; i < 100; i++)
      await request(app)
        .options("/organisations")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST")
        .expect(204);
    await request(app)
      .post("/organisations")
      .set("Origin", origin)
      .send({})
      .expect(400);
  });

  it("does not grant a disallowed origin, method, or authorization header on preflight", async () => {
    const app = createApp({ corsOrigins: [origin] });
    const disallowed = await request(app)
      .options("/organisations")
      .set("Origin", "https://other.example")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    expect(disallowed.headers).not.to.have.property(
      "access-control-allow-origin",
    );
    const unsupported = await request(app)
      .options("/organisations")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "DELETE")
      .set("Access-Control-Request-Headers", "authorization")
      .expect(204);
    expect(unsupported.headers["access-control-allow-methods"]).not.to.include(
      "DELETE",
    );
    expect(unsupported.headers["access-control-allow-headers"]).not.to.include(
      "authorization",
    );
  });

  it("keeps browser access headers and Helmet headers on error responses", async () => {
    const response = await request(createApp({ corsOrigins: [origin] }))
      .post("/organisations")
      .set("Origin", origin)
      .set("Content-Type", "application/json")
      .send('{"broken"')
      .expect(400);
    expect(response.headers["access-control-allow-origin"]).to.equal(origin);
    expect(response.headers["x-content-type-options"]).to.equal("nosniff");
    expect(response.headers).not.to.have.property("x-powered-by");
    expect(response.body.error.code).to.equal("INVALID_JSON");
  });
});
