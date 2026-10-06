import { expect } from "chai";
import { describe, it } from "mocha";
import SwaggerParser from "@apidevtools/swagger-parser";
import request from "supertest";
import server from "../server.js";

describe("OpenAPI documentation", () => {
  it("serves a valid specification with every API operation and examples", async () => {
    const response = await request(server).get("/swagger.json").expect(200);
    expect(response.headers["content-type"]).to.match(/application\/json/);
    // Validate a clone: the parser dereferences recursive schemas in place.
    const spec = await SwaggerParser.validate(structuredClone(response.body));
    for (const [path, methods] of [
      ["/", ["get"]],
      ["/organisations", ["get", "post"]],
      ["/organisations/{id}", ["get", "patch", "delete"]],
      ["/organisations/{id}/relationships", ["get"]],
      ["/swagger.json", ["get"]],
      ["/swagger", ["get"]],
      ["/swagger/", ["get"]],
    ] as const) {
      for (const method of methods) {
        expect(spec.paths?.[path]).to.have.property(method);
      }
    }
    expect(
      response.body.components.schemas.OrganisationInput.example,
    ).to.have.property("daughters");
    expect(
      response.body.components.schemas.RelationshipsResponse.example.pagination
        .total_count,
    ).to.equal(1);
    expect(
      response.body.components.responses.RateLimited.headers,
    ).to.have.property("Retry-After");
  });
});
