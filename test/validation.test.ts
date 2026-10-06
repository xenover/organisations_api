import { expect } from "chai";
import express from "express";
import { describe, it } from "mocha";
import request from "supertest";
import { validate } from "../src/middleware/validate.js";
import {
  organisationInputSchema,
  organisationQuerySchema,
} from "../src/schemas/organisations.js";

describe("Validated handler inputs", () => {
  const app = express();
  app.use(express.json());
  app.get("/query", validate(organisationQuerySchema, "query"), (req, res) => {
    // This numeric operation also checks that the middleware supplies a typed page.
    const page: number = res.locals.query.page;
    res.json({ parsed: res.locals.query, nextPage: page + 1, raw: req.query });
  });
  app.post("/body", validate(organisationInputSchema, "body"), (req, res) => {
    const name: string = res.locals.body.org_name;
    res.json({ parsed: res.locals.body, name, raw: req.body });
  });

  it("supplies page 1 when omitted without changing the query getter", async () => {
    const response = await request(app).get("/query?name=Child").expect(200);
    expect(response.body).to.deep.equal({
      parsed: { name: "Child", page: 1 },
      nextPage: 2,
      raw: { name: "Child" },
    });
  });

  it("parses a decimal page to a number and strips unknown query fields", async () => {
    const response = await request(app)
      .get("/query?name=Child&page=002&extra=ignored")
      .expect(200);
    expect(response.body).to.deep.equal({
      parsed: { name: "Child", page: 2 },
      nextPage: 3,
      raw: { name: "Child", page: "002", extra: "ignored" },
    });
  });

  it("preserves names and optional daughters while stripping unknown fields recursively", async () => {
    const body = {
      org_name: " Parent ",
      extra: "ignored",
      daughters: [
        { org_name: " Child ", daughters: [], extra: "ignored" },
        { org_name: "Leaf" },
      ],
    };
    const response = await request(app).post("/body").send(body).expect(200);
    expect(response.body).to.deep.equal({
      parsed: {
        org_name: " Parent ",
        daughters: [
          { org_name: " Child ", daughters: [] },
          { org_name: "Leaf" },
        ],
      },
      name: " Parent ",
      raw: body,
    });
  });
});
