import * as service from "../services/organisations.js";
import type { Express } from "express";
import type { Query } from "express-serve-static-core";
import { validate } from "../middleware/validate.js";
import { createMutationLimiter } from "../middleware/mutation-limit.js";
import type { ErrorResponse } from "../errors/index.js";
import {
  organisationInputSchema,
  organisationQuerySchema,
  organisationParamsSchema,
  organisationUpdateSchema,
  paginationQuerySchema,
} from "../schemas/organisations.js";
import type {
  ApiResponse,
  Organisation,
  OrganisationInput,
  OrganisationQuery,
  OrganisationRelationship,
  OrganisationParams,
  OrganisationUpdate,
  PaginatedResponse,
  PaginationQuery,
} from "../types/organisations.js";

type OrganisationResponse = ApiResponse<Organisation> | ErrorResponse;
type RelationshipsResponse =
  PaginatedResponse<OrganisationRelationship> | ErrorResponse;

const organisationRoutes = (app: Express): void => {
  const mutationLimit = createMutationLimiter();
  /**
   * @openapi
   * /organisations:
   *   get:
   *     summary: Look up parent, sister, and daughter relationships by name
   *     parameters:
   *       - in: query
   *         name: name
   *         required: true
   *         schema: { type: string, minLength: 1 }
   *         example: Child
   *       - $ref: '#/components/parameters/Limit'
   *       - $ref: '#/components/parameters/Offset'
   *       - $ref: '#/components/parameters/Page'
   *     responses:
   *       '200': { $ref: '#/components/responses/Relationships' }
   *       '400': { $ref: '#/components/responses/ValidationError' }
   *       '500': { $ref: '#/components/responses/InternalError' }
   */
  app.get<
    Record<string, never>,
    RelationshipsResponse,
    never,
    Query,
    { query: OrganisationQuery }
  >(
    "/organisations",
    validate(organisationQuerySchema, "query"),
    async (_req, res) => {
      const { name, ...pagination } = res.locals.query;
      res.json(await service.get(name, pagination));
    },
  );

  /**
   * @openapi
   * /organisations:
   *   post:
   *     summary: Create or merge an organisation tree atomically
   *     description: Reuses existing names and relationships. Returns 201 for a new root, or 200 for an existing root.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OrganisationInput' }
   *           example: { org_name: Parent, daughters: [{ org_name: Child }] }
   *     responses:
   *       '201': { $ref: '#/components/responses/CreatedOrganisation' }
   *       '200': { $ref: '#/components/responses/Organisation' }
   *       '400': { $ref: '#/components/responses/ValidationError' }
   *       '413': { $ref: '#/components/responses/PayloadTooLarge' }
   *       '415': { $ref: '#/components/responses/UnsupportedMediaType' }
   *       '429': { $ref: '#/components/responses/RateLimited' }
   *       '500': { $ref: '#/components/responses/InternalError' }
   */
  app.post<
    Record<string, never>,
    OrganisationResponse,
    unknown,
    Query,
    { body: OrganisationInput }
  >(
    "/organisations",
    mutationLimit,
    validate(organisationInputSchema, "body"),
    async (_req, res) => {
      const { organisation, created } = await service.create(res.locals.body);
      if (created) res.location(`/organisations/${organisation.id}`);
      res.status(created ? 201 : 200).json({ data: organisation });
    },
  );

  /**
   * @openapi
   * /organisations/{id}:
   *   get:
   *     summary: Get one organisation by ID
   *     parameters:
   *       - $ref: '#/components/parameters/Id'
   *     responses:
   *       '200': { $ref: '#/components/responses/Organisation' }
   *       '400': { $ref: '#/components/responses/ValidationError' }
   *       '404': { $ref: '#/components/responses/NotFound' }
   *       '500': { $ref: '#/components/responses/InternalError' }
   */
  app.get<
    { id: string },
    OrganisationResponse,
    never,
    Query,
    { params: OrganisationParams }
  >(
    "/organisations/:id",
    validate(organisationParamsSchema, "params"),
    async (_req, res) => {
      res.json({ data: await service.getById(res.locals.params.id) });
    },
  );

  /**
   * @openapi
   * /organisations/{id}:
   *   patch:
   *     summary: Rename an organisation without changing its relationships
   *     parameters:
   *       - $ref: '#/components/parameters/Id'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/OrganisationUpdate' }
   *           example: { org_name: Renamed organisation }
   *     responses:
   *       '200': { $ref: '#/components/responses/Organisation' }
   *       '400': { $ref: '#/components/responses/ValidationError' }
   *       '404': { $ref: '#/components/responses/NotFound' }
   *       '409': { $ref: '#/components/responses/Conflict' }
   *       '413': { $ref: '#/components/responses/PayloadTooLarge' }
   *       '415': { $ref: '#/components/responses/UnsupportedMediaType' }
   *       '429': { $ref: '#/components/responses/RateLimited' }
   *       '500': { $ref: '#/components/responses/InternalError' }
   */
  app.patch<
    { id: string },
    OrganisationResponse,
    unknown,
    Query,
    { params: OrganisationParams; body: OrganisationUpdate }
  >(
    "/organisations/:id",
    mutationLimit,
    validate(organisationParamsSchema, "params"),
    validate(organisationUpdateSchema, "body"),
    async (_req, res) => {
      res.json({
        data: await service.update(
          res.locals.params.id,
          res.locals.body.org_name,
        ),
      });
    },
  );

  /**
   * @openapi
   * /organisations/{id}:
   *   delete:
   *     summary: Delete an organisation and its relationship links
   *     description: Related organisations are retained. The response contains the deleted organisation.
   *     parameters:
   *       - $ref: '#/components/parameters/Id'
   *     responses:
   *       '200': { $ref: '#/components/responses/Organisation' }
   *       '400': { $ref: '#/components/responses/ValidationError' }
   *       '404': { $ref: '#/components/responses/NotFound' }
   *       '429': { $ref: '#/components/responses/RateLimited' }
   *       '500': { $ref: '#/components/responses/InternalError' }
   */
  app.delete<
    { id: string },
    OrganisationResponse,
    unknown,
    Query,
    { params: OrganisationParams }
  >(
    "/organisations/:id",
    mutationLimit,
    validate(organisationParamsSchema, "params"),
    async (_req, res) => {
      res.json({ data: await service.remove(res.locals.params.id) });
    },
  );

  /**
   * @openapi
   * /organisations/{id}/relationships:
   *   get:
   *     summary: Look up parent, sister, and daughter relationships by ID
   *     parameters:
   *       - $ref: '#/components/parameters/Id'
   *       - $ref: '#/components/parameters/Limit'
   *       - $ref: '#/components/parameters/Offset'
   *       - $ref: '#/components/parameters/Page'
   *     responses:
   *       '200': { $ref: '#/components/responses/Relationships' }
   *       '400': { $ref: '#/components/responses/ValidationError' }
   *       '404': { $ref: '#/components/responses/NotFound' }
   *       '500': { $ref: '#/components/responses/InternalError' }
   */
  app.get<
    { id: string },
    RelationshipsResponse,
    never,
    Query,
    { params: OrganisationParams; query: PaginationQuery }
  >(
    "/organisations/:id/relationships",
    validate(organisationParamsSchema, "params"),
    validate(paginationQuerySchema, "query"),
    async (_req, res) => {
      res.json(
        await service.getRelationships(res.locals.params.id, res.locals.query),
      );
    },
  );
};

export default organisationRoutes;
