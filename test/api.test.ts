import request from "supertest";
import { expect } from "chai";
import knexModule from "knex";
import configurations from "../knexfile.js";
import { after, before, describe, it } from "mocha";
import type {
  OrganisationInput,
  OrganisationRelationship,
} from "../src/types/organisations.js";

const config = configurations.test;
const knex = knexModule.knex(config);

// The test preload sets NODE_ENV before application configuration is imported.
const { default: server } = await import("../server.js");

describe("Organisations", () => {
  before(async function () {
    await knex.migrate.up();
  });

  after(async function () {
    await knex("relationships").del().then();
    await knex("organisations").del().then();
    await knex.migrate.down();
  });

  describe("relationships handling", () => {
    it("it should return the correct relationships for an org", async () => {
      const inputJson: OrganisationInput = {
        org_name: "Parent1",
        daughters: [
          {
            org_name: "Child1",
            daughters: [
              {
                org_name: "GrandChild1",
              },
            ],
          },
          {
            org_name: "Child2",
            daughters: [
              {
                org_name: "GrandChild3",
              },
              {
                org_name: "GrandChild4",
                daughters: [
                  {
                    org_name: "GreatGrandChild1",
                  },
                ],
              },
            ],
          },
        ],
      };
      const expectedJson: OrganisationRelationship[] = [
        {
          org_name: "Child2",
          relationship_type: "parent",
        },
        {
          org_name: "GrandChild3",
          relationship_type: "sister",
        },
        {
          org_name: "GreatGrandChild1",
          relationship_type: "daughter",
        },
      ];

      // POST organisations
      await request(server).post("/organisations").send(inputJson).expect(201);
      // GET organisations
      await request(server)
        .get("/organisations")
        .query({ name: "GrandChild4" })
        .expect(200)
        .then((response) => expect(response.body).to.deep.equal(expectedJson));
    });
  });

  describe("input validation", () => {
    for (const { body, path } of [
      { body: {}, path: "body.org_name" },
      { body: { org_name: "" }, path: "body.org_name" },
      { body: { org_name: "   " }, path: "body.org_name" },
      { body: { org_name: 42 }, path: "body.org_name" },
      {
        body: { org_name: "InvalidParent", daughters: "InvalidChild" },
        path: "body.daughters",
      },
      {
        body: { org_name: "InvalidParent", daughters: null },
        path: "body.daughters",
      },
      {
        body: {
          org_name: "InvalidParent",
          daughters: [{ org_name: "ValidChild" }, { org_name: 42 }],
        },
        path: "body.daughters.1.org_name",
      },
      {
        body: {
          org_name: "InvalidParent",
          daughters: [
            {
              org_name: "ValidChild",
              daughters: [{ org_name: "ValidGrandchild" }, { org_name: " " }],
            },
          ],
        },
        path: "body.daughters.0.daughters.1.org_name",
      },
    ]) {
      it(`rejects invalid body ${JSON.stringify(body)} without writes`, async () => {
        const before = await Promise.all([
          knex("organisations").select("id"),
          knex("relationships").select("id"),
        ]);
        const response = await request(server)
          .post("/organisations")
          .send(body)
          .expect(400);
        expect(response.body.error).to.include({
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          statusCode: 400,
        });
        expect(response.body.error.details.issues)
          .to.be.an("array")
          .with.length.greaterThan(0);
        expect(response.body.error.details.issues[0].path).to.equal(path);
        const after = await Promise.all([
          knex("organisations").select("id"),
          knex("relationships").select("id"),
        ]);
        expect(after).to.deep.equal(before);
      });
    }

    for (const query of [
      {},
      { name: "" },
      { name: ["Child1", "Child2"] },
      ...["0", "-1", "1.5", "abc", "9007199254740992"].map((page) => ({
        name: "GrandChild4",
        page,
      })),
      { name: "GrandChild4", page: ["1", "2"] },
    ]) {
      it(`rejects invalid query ${JSON.stringify(query)}`, async () => {
        const response = await request(server)
          .get("/organisations")
          .query(query)
          .expect(400);
        expect(response.body.error).to.include({
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          statusCode: 400,
        });
        expect(response.body.error.details.issues)
          .to.be.an("array")
          .with.length.greaterThan(0);
        expect(response.body.error.details.issues[0].path).to.match(/^query\./);
      });
    }

    it("accepts an explicit valid page and preserves pagination", async () => {
      const response = await request(server)
        .get("/organisations")
        .query({ name: "GrandChild4", page: "2" })
        .expect(200);
      expect(response.body).to.deep.equal([]);
    });
  });

  describe("Documentation and existing endpoint enhancements", () => {
    it("preserves POST's 201 OK response when creating and reusing a tree", async () => {
      const body = {
        org_name: "DocumentedParent",
        daughters: [{ org_name: "DocumentedChild" }],
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await request(server)
          .post("/organisations")
          .send(body)
          .expect(201);
        expect(response.text).to.equal("OK");
        expect(response.headers["content-type"]).to.match(/text\/plain/);
        expect(response.headers.location).to.equal(undefined);
        expect(response.headers.ratelimit).to.be.a("string");
      }
      const response = await request(server)
        .get("/organisations?name=DocumentedChild")
        .expect(200);
      expect(response.body).to.deep.equal([
        { org_name: "DocumentedParent", relationship_type: "parent" },
      ]);
    });

    it("serves Swagger UI and local assets under Helmet's headers", async () => {
      const redirect = await request(server).get("/swagger").expect(301);
      expect(redirect.headers.location).to.equal("/swagger/");
      const html = await request(server).get("/swagger/").expect(200);
      expect(html.headers["content-type"]).to.match(/text\/html/);
      expect(html.text).to.include("swagger-ui-bundle.js");
      expect(html.headers["x-content-type-options"]).to.equal("nosniff");
      for (const asset of [
        "swagger-ui.css",
        "swagger-ui-bundle.js",
        "swagger-ui-init.js",
      ]) {
        await request(server).get(`/swagger/${asset}`).expect(200);
      }
      const init = await request(server)
        .get("/swagger/swagger-ui-init.js")
        .expect(200);
      expect(init.text).to.include("/swagger.json");
    });

    it("returns unique request IDs on successes and errors while preserving the root response", async () => {
      const success = await request(server).get("/").expect(200);
      const failure = await request(server).get("/missing").expect(404);
      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(success.headers["x-request-id"]).to.match(uuid);
      expect(failure.headers["x-request-id"]).to.match(uuid);
      expect(success.headers["x-request-id"]).not.to.equal(
        failure.headers["x-request-id"],
      );
      expect(success.text).to.equal("Nothing here");
      expect(success.headers["content-type"]).to.match(/text\/plain/);
    });

    it("keeps ID-based and mutation endpoints outside the original API", async () => {
      await request(server).get("/organisations/1").expect(404);
      await request(server).get("/organisations/1/relationships").expect(404);
      await request(server)
        .patch("/organisations/1")
        .send({ org_name: "Ignored" })
        .expect(404);
      await request(server).delete("/organisations/1").expect(404);
    });
  });

  it("sets security headers on success, validation errors, and missing routes", async () => {
    for (const [path, status] of [
      ["/", 200],
      ["/organisations", 400],
      ["/missing", 404],
    ] as const) {
      const response = await request(server).get(path).expect(status);
      expect(response.headers["x-content-type-options"]).to.equal("nosniff");
      expect(response.headers["x-frame-options"]).to.equal("SAMEORIGIN");
      expect(response.headers["x-powered-by"]).to.equal(undefined);
      expect(response.headers["strict-transport-security"]).to.equal(undefined);
      expect(response.headers["content-security-policy"]).not.to.include(
        "upgrade-insecure-requests",
      );
    }
  });

  it("returns a structured 404 for missing routes", async () => {
    const response = await request(server).get("/missing").expect(404);
    expect(response.body).to.deep.equal({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        statusCode: 404,
        details: {},
      },
    });
  });

  it("returns a safe JSON error for malformed request bodies", async () => {
    const response = await request(server)
      .post("/organisations")
      .set("Content-Type", "application/json")
      .send('{"org_name": "Private input",')
      .expect(400);
    expect(response.body).to.deep.equal({
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON",
        statusCode: 400,
        details: {},
      },
    });
    expect(response.text).not.to.include("Private input");
    expect(response.headers["x-content-type-options"]).to.equal("nosniff");
  });

  it("returns a structured 413 when the request body exceeds the limit", async () => {
    const response = await request(server)
      .post("/organisations")
      .send({ org_name: "x".repeat(110 * 1024) })
      .expect(413);
    expect(response.body).to.deep.equal({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body is too large",
        statusCode: 413,
        details: {},
      },
    });
  });

  it("returns a structured 415 for an unsupported JSON charset", async () => {
    const response = await request(server)
      .post("/organisations")
      .set("Content-Type", "application/json; charset=unsupported")
      .send('{"org_name":"Parent"}')
      .expect(415);
    expect(response.body.error).to.deep.equal({
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "Unsupported request body encoding",
      statusCode: 415,
      details: {},
    });
  });
});
