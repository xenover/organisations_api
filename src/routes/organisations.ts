import * as service from "../services/organisations.js";
import type { Express } from "express";
import type { Query } from "express-serve-static-core";
import { validate } from "../middleware/validate.js";
import { createPostLimiter } from "../middleware/post-limit.js";
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
  /**
   * @openapi
   * /organisations:
   *   get:
   *     summary: Look up parent, sister, and daughter relationships by name
   *     parameters:
   *       - in: query
   *         name: name
   *         required: true
   *         description: One nonblank organisation name; original whitespace is preserved.
   *         schema: { type: string, minLength: 1 }
   *         example: Child
   *       - in: query
   *         name: page
   *         description: Positive decimal integer; returns 100 results per page, sorted by name.
   *         schema: { type: integer, minimum: 1, maximum: 9007199254740991, default: 1 }
   *     responses:
   *       '200': { $ref: '#/components/responses/Relationships' }
   *       '400': { $ref: '#/components/responses/ValidationError' }
   *       '500': { $ref: '#/components/responses/InternalError' }
   */
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
      res.json(await service.get(name, page));
    },
  );

  /**
   * @openapi
   * /organisations:
   *   post:
   *     summary: Create an organisation tree and its relationships
   *     description: Reuses existing names and relationship links. Successful requests return 201 with the text OK.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OrganisationInput' }
   *           example: { org_name: Parent, daughters: [{ org_name: Child }] }
   *     responses:
   *       '201':
   *         description: Organisation tree processed successfully
   *         headers:
   *           X-Request-ID: { schema: { type: string, format: uuid } }
   *         content:
   *           text/plain:
   *             schema: { type: string, enum: [OK] }
   *             example: OK
   *       '400': { $ref: '#/components/responses/ValidationError' }
   *       '413': { $ref: '#/components/responses/PayloadTooLarge' }
   *       '415': { $ref: '#/components/responses/UnsupportedMediaType' }
   *       '429': { $ref: '#/components/responses/RateLimited' }
   *       '500': { $ref: '#/components/responses/InternalError' }
   */
  app.post<
    Record<string, never>,
    string | ErrorResponse,
    unknown,
    Query,
    { body: OrganisationInput }
  >(
    "/organisations",
    createPostLimiter(),
    validate(organisationInputSchema, "body"),
    async (_req, res) => {
      await service.insert(res.locals.body);
      res.status(201).type("text/plain").send("OK");
    },
  );
};

export default organisationRoutes;
