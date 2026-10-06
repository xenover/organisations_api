import * as service from "../services/organisations.js";
import type { Express } from "express";
import type { Query } from "express-serve-static-core";
import { validate } from "../middleware/validate.js";
import type { ErrorResponse } from "../errors/index.js";
import {
  organisationInputSchema,
  organisationQuerySchema,
} from "../schemas/organisations.js";
import type {
  OrganisationInput,
  OrganisationQuery,
  OrganisationRelationship,
} from "../types/organisations.js";

const organisationRoutes = (app: Express): void => {
  app.get<
    Record<string, never>,
    OrganisationRelationship[] | ErrorResponse,
    never,
    Query,
    { query: OrganisationQuery }
  >(
    "/organisations",
    validate(organisationQuerySchema, "query"),
    async (_req, res) => {
      const { name, page } = res.locals.query;
      const rows = await service.get(name, page);
      res.status(200);
      res.send(rows);
    },
  );

  app.post<
    Record<string, never>,
    string | ErrorResponse,
    unknown,
    Query,
    { body: OrganisationInput }
  >(
    "/organisations",
    validate(organisationInputSchema, "body"),
    async (_req, res) => {
      await service.insert(res.locals.body);
      res.status(201);
      res.send("OK");
    },
  );
};

export default organisationRoutes;
