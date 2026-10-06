import request from "supertest";
import { expect } from "chai";
import knexModule from "knex";
import configurations from "../knexfile.js";
import { after, before, describe, it } from "mocha";
import type {
  OrganisationInput,
  OrganisationRelationship,
} from "../src/types/organisations.js";

function organisationLocation(response: {
  headers: Record<string, string | undefined>;
}): string {
  const location = response.headers.location;
  if (!location)
    throw new Error("Expected a Location header for a new organisation");
  return location;
}

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
      const created = await request(server)
        .post("/organisations")
        .send(inputJson)
        .expect(201);
      expect(created.body.data.org_name).to.equal("Parent1");
      expect(organisationLocation(created)).to.equal(
        `/organisations/${created.body.data.id}`,
      );
      expect(created.headers["content-type"]).to.match(/application\/json/);
      // GET organisations
      await request(server)
        .get("/organisations")
        .query({ name: "GrandChild4" })
        .expect(200)
        .then((response) =>
          expect(response.body).to.deep.equal({
            data: expectedJson,
            pagination: { limit: 100, offset: 0, total_count: 3 },
          }),
        );
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
      expect(response.body).to.deep.equal({
        data: [],
        pagination: { limit: 100, offset: 100, total_count: 3 },
      });
    });
  });

  describe("API enhancements", () => {
    it("rolls back the whole tree when a daughter insert fails", async () => {
      const before = await Promise.all([
        knex("organisations").select("id"),
        knex("relationships").select("id"),
      ]);
      await knex.raw(`CREATE TRIGGER reject_test_daughter BEFORE INSERT ON organisations
        WHEN NEW.name = 'RejectedDaughter' BEGIN
          SELECT RAISE(ABORT, 'Forced child insert failure');
        END`);
      try {
        const failed = await request(server)
          .post("/organisations")
          .send({
            org_name: "RollbackParent",
            daughters: [
              { org_name: "InsertedBeforeFailure" },
              { org_name: "RejectedDaughter" },
            ],
          })
          .expect(500);
        expect(failed.body.error.code).to.equal("INTERNAL_ERROR");
        expect(failed.text).not.to.include("Forced child insert failure");
        const after = await Promise.all([
          knex("organisations").select("id"),
          knex("relationships").select("id"),
        ]);
        expect(after).to.deep.equal(before);
      } finally {
        await knex.raw("DROP TRIGGER reject_test_daughter");
      }
    });
    it("returns an ID, reuses existing roots, and merges each relationship only once", async () => {
      const body = {
        org_name: "MergeParent",
        daughters: [{ org_name: "MergeChild" }],
      };
      const first = await request(server)
        .post("/organisations")
        .send(body)
        .expect(201);
      const repeated = await request(server)
        .post("/organisations")
        .send(body)
        .expect(200);
      expect(repeated.body).to.deep.equal(first.body);
      expect(repeated.headers.location).to.equal(undefined);
      const found = await request(server)
        .get(organisationLocation(first))
        .expect(200);
      expect(found.body).to.deep.equal(first.body);
      const links = await request(server)
        .get(`${organisationLocation(first)}/relationships`)
        .expect(200);
      expect(links.body).to.deep.equal({
        data: [{ org_name: "MergeChild", relationship_type: "daughter" }],
        pagination: { limit: 100, offset: 0, total_count: 1 },
      });
      expect(first.headers.ratelimit).to.be.a("string");
    });

    it("renames by ID and retains relationships", async () => {
      const created = await request(server)
        .post("/organisations")
        .send({
          org_name: "RenameParent",
          daughters: [{ org_name: "RenameChild" }],
        })
        .expect(201);
      const renamed = await request(server)
        .patch(organisationLocation(created))
        .send({ org_name: "RenamedParent" })
        .expect(200);
      expect(renamed.body).to.deep.equal({
        data: { id: created.body.data.id, org_name: "RenamedParent" },
      });
      const found = await request(server)
        .get(organisationLocation(created))
        .expect(200);
      expect(found.body).to.deep.equal(renamed.body);
      const child = await request(server)
        .get("/organisations?name=RenameChild")
        .expect(200);
      expect(child.body.data).to.deep.equal([
        { org_name: "RenamedParent", relationship_type: "parent" },
      ]);
    });

    it("rejects name collisions without changing the organisation and accepts a no-op rename", async () => {
      const created = await request(server)
        .post("/organisations")
        .send({ org_name: "ConflictOriginal" })
        .expect(201);
      await request(server)
        .post("/organisations")
        .send({ org_name: "ConflictOther" })
        .expect(201);
      const rejected = await request(server)
        .patch(organisationLocation(created))
        .send({ org_name: "ConflictOther" })
        .expect(409);
      expect(rejected.body.error).to.include({
        code: "CONFLICT",
        statusCode: 409,
      });
      const found = await request(server)
        .get(organisationLocation(created))
        .expect(200);
      expect(found.body).to.deep.equal(created.body);
      const unchanged = await request(server)
        .patch(organisationLocation(created))
        .send({ org_name: "ConflictOriginal" })
        .expect(200);
      expect(unchanged.body).to.deep.equal(created.body);
    });

    it("deletes links in both directions while retaining related organisations", async () => {
      const created = await request(server)
        .post("/organisations")
        .send({
          org_name: "DeleteParent",
          daughters: [
            {
              org_name: "DeleteMiddle",
              daughters: [{ org_name: "DeleteLeaf" }],
            },
          ],
        })
        .expect(201);
      const middle = await knex("organisations")
        .where({ name: "DeleteMiddle" })
        .first<{ id: number }>();
      if (!middle) throw new Error("Test middle organisation missing");
      const deleted = await request(server)
        .delete(`/organisations/${middle.id}`)
        .expect(200);
      expect(deleted.body).to.deep.equal({
        data: { id: middle.id, org_name: "DeleteMiddle" },
      });
      await request(server).get(`/organisations/${middle.id}`).expect(404);
      await request(server).get(organisationLocation(created)).expect(200);
      expect(
        await knex("organisations").where({ name: "DeleteLeaf" }).first(),
      ).not.to.equal(undefined);
      expect(
        await knex("relationships")
          .where({ parent_id: middle.id })
          .orWhere({ child_id: middle.id }),
      ).to.deep.equal([]);
      const remaining = await request(server)
        .get(`${organisationLocation(created)}/relationships`)
        .expect(200);
      expect(remaining.body.pagination.total_count).to.equal(0);
    });

    for (const id of ["abc", "0", "-1", "1.5", "9007199254740992"]) {
      it(`validates path ID ${id} on all ID endpoints`, async () => {
        const responses = [
          await request(server).get(`/organisations/${id}`).expect(400),
          await request(server)
            .patch(`/organisations/${id}`)
            .send({ org_name: "Ignored" })
            .expect(400),
          await request(server).delete(`/organisations/${id}`).expect(400),
          await request(server)
            .get(`/organisations/${id}/relationships`)
            .expect(400),
        ];
        for (const response of responses) {
          expect(response.body.error.code).to.equal("VALIDATION_ERROR");
          expect(response.body.error.details.issues[0].path).to.equal(
            "params.id",
          );
        }
      });
    }

    it("returns structured 404s for valid but missing IDs on all ID endpoints", async () => {
      const path = "/organisations/2147483647";
      const responses = [
        await request(server).get(path).expect(404),
        await request(server)
          .patch(path)
          .send({ org_name: "Missing" })
          .expect(404),
        await request(server).delete(path).expect(404),
        await request(server)
          .get(path + "/relationships")
          .expect(404),
      ];
      for (const response of responses)
        expect(response.body.error).to.deep.equal({
          code: "NOT_FOUND",
          message: "Organisation not found",
          statusCode: 404,
          details: {},
        });
    });

    it("rejects invalid or unsupported PATCH fields before changing the record", async () => {
      const created = await request(server)
        .post("/organisations")
        .send({ org_name: "PatchValidation" })
        .expect(201);
      for (const body of [
        {},
        { org_name: " " },
        { org_name: 3 },
        { org_name: "NewName", daughters: [] },
      ]) {
        const rejected = await request(server)
          .patch(organisationLocation(created))
          .send(body)
          .expect(400);
        expect(rejected.body.error.code).to.equal("VALIDATION_ERROR");
      }
      const found = await request(server)
        .get(organisationLocation(created))
        .expect(200);
      expect(found.body).to.deep.equal(created.body);
    });

    it("paginates by limit/offset or page and reports the full count beyond the last page", async () => {
      const row = await knex("organisations")
        .where({ name: "GrandChild4" })
        .first<{ id: number }>();
      if (!row) throw new Error("Test organisation missing");
      const byName = await request(server)
        .get("/organisations")
        .query({ name: "GrandChild4", limit: "1", offset: "1" })
        .expect(200);
      expect(byName.body).to.deep.equal({
        data: [{ org_name: "GrandChild3", relationship_type: "sister" }],
        pagination: { limit: 1, offset: 1, total_count: 3 },
      });
      const byId = await request(server)
        .get(`/organisations/${row.id}/relationships`)
        .query({ limit: "1", page: "2" })
        .expect(200);
      expect(byId.body).to.deep.equal(byName.body);
      const beyond = await request(server)
        .get(`/organisations/${row.id}/relationships`)
        .query({ limit: "2", offset: "99" })
        .expect(200);
      expect(beyond.body).to.deep.equal({
        data: [],
        pagination: { limit: 2, offset: 99, total_count: 3 },
      });
    });

    for (const query of [
      { limit: "0" },
      { limit: "101" },
      { limit: "1.5" },
      { limit: ["1", "2"] },
      { offset: "-1" },
      { offset: "1.5" },
      { offset: "9007199254740992" },
      { page: "2", offset: "1" },
      { page: "9007199254740991" },
    ]) {
      it(`rejects invalid pagination ${JSON.stringify(query)}`, async () => {
        const response = await request(server)
          .get("/organisations")
          .query({ name: "GrandChild4", ...query })
          .expect(400);
        expect(response.body.error.code).to.equal("VALIDATION_ERROR");
        expect(response.body.error.details.issues[0].path).to.match(/^query\./);
      });
    }

    it("returns an empty list and zero count for an unknown name", async () => {
      const response = await request(server)
        .get("/organisations?name=DoesNotExist")
        .expect(200);
      expect(response.body).to.deep.equal({
        data: [],
        pagination: { limit: 100, offset: 0, total_count: 0 },
      });
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

    it("returns a request ID on successes and errors", async () => {
      const success = await request(server).get("/").expect(200);
      const failure = await request(server).get("/missing").expect(404);
      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(success.headers["x-request-id"]).to.match(uuid);
      expect(failure.headers["x-request-id"]).to.match(uuid);
      expect(success.headers["x-request-id"]).not.to.equal(
        failure.headers["x-request-id"],
      );
      expect(success.body).to.deep.equal({
        data: { name: "Organisations API", documentation: "/swagger" },
      });
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
