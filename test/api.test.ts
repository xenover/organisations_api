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
    for (const body of [
      {},
      { org_name: "" },
      { org_name: "   " },
      { org_name: 42 },
      { org_name: "InvalidParent", daughters: "InvalidChild" },
      {
        org_name: "InvalidParent",
        daughters: [{ org_name: "ValidChild" }, { org_name: 42 }],
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
        expect(response.body).to.have.property("error", "Invalid request");
        expect(response.body.issues)
          .to.be.an("array")
          .with.length.greaterThan(0);
        expect(response.body.issues[0].path).to.match(/^body\./);
        if (Array.isArray(body.daughters)) {
          expect(response.body.issues[0].path).to.equal(
            "body.daughters.1.org_name",
          );
        }
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
        expect(response.body).to.have.property("error", "Invalid request");
        expect(response.body.issues)
          .to.be.an("array")
          .with.length.greaterThan(0);
        expect(response.body.issues[0].path).to.match(/^query\./);
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
});
