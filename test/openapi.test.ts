import { expect } from "chai";
import { describe, it } from "mocha";
import SwaggerParser from "@apidevtools/swagger-parser";
import request from "supertest";
import createApp from "../src/app.js";

describe("OpenAPI documentation", () => {
  it("documents the existing API and documentation resources with valid examples", async () => {
    const response = await request(createApp())
      .get("/swagger.json")
      .expect(200);
    expect(response.headers["content-type"]).to.match(/application\/json/);
    // Validate a clone: the parser dereferences recursive schemas in place.
    const spec = await SwaggerParser.validate(structuredClone(response.body));
    expect(Object.keys(spec.paths ?? {}).sort()).to.deep.equal([
      "/",
      "/health",
      "/organisations",
      "/ready",
      "/swagger",
      "/swagger.json",
      "/swagger/",
    ]);
    expect(
      Object.keys(spec.paths?.["/organisations"] ?? {}).sort(),
    ).to.deep.equal(["get", "post"]);
    expect(
      response.body.paths["/organisations"].post.responses["201"].content[
        "text/plain"
      ].example,
    ).to.equal("OK");
    expect(response.body.components.schemas.Relationships.type).to.equal(
      "array",
    );
    expect(
      response.body.components.schemas.Relationships.example,
    ).to.deep.equal([{ org_name: "Parent", relationship_type: "parent" }]);
    expect(
      response.body.paths["/organisations"].get.parameters.map(
        (parameter: { name: string }) => parameter.name,
      ),
    ).to.deep.equal(["name", "page"]);
    expect(
      response.body.components.schemas.OrganisationInput.example,
    ).to.have.property("daughters");
    expect(
      response.body.components.responses.RateLimited.headers,
    ).to.have.property("Retry-After");
  });
});
