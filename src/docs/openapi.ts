import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";
import { ERROR_DEFINITIONS } from "../errors/definitions.js";

const jsonResponse = (
  description: string,
  schema: object,
  example?: object,
) => ({
  description,
  headers: {
    "X-Request-ID": {
      schema: { type: "string", format: "uuid" },
      description: "Request correlation ID",
    },
  },
  content: { "application/json": { schema, ...(example ? { example } : {}) } },
});
const organisationResponse = jsonResponse("An organisation", {
  $ref: "#/components/schemas/OrganisationResponse",
});
const errorResponse = (definition: {
  code: string;
  message: string;
  statusCode: number;
}) =>
  jsonResponse(
    definition.message,
    { $ref: "#/components/schemas/ErrorResponse" },
    { error: { ...definition, details: {} } },
  );

export const openApiDocument = swaggerJsdoc({
  failOnErrors: true,
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Organisations API",
      version: "1.0.0",
      description:
        "Local organisation trees and relationships. JSON successes use data; relationship lists also include pagination. Mutation requests share a limit of 100 per IP per minute.",
    },
    servers: [{ url: "/" }],
    components: {
      schemas: {
        Organisation: {
          type: "object",
          required: ["id", "org_name"],
          properties: {
            id: { type: "integer", minimum: 1 },
            org_name: { type: "string", minLength: 1, pattern: "\\S" },
          },
          example: { id: 1, org_name: "Parent" },
        },
        OrganisationInput: {
          type: "object",
          required: ["org_name"],
          description:
            "Names preserve whitespace but must contain a non-whitespace character. Unknown fields are ignored, including inside daughters.",
          properties: {
            org_name: { type: "string", minLength: 1, pattern: "\\S" },
            daughters: {
              type: "array",
              items: { $ref: "#/components/schemas/OrganisationInput" },
            },
          },
          example: { org_name: "Parent", daughters: [{ org_name: "Child" }] },
        },
        OrganisationUpdate: {
          type: "object",
          required: ["org_name"],
          additionalProperties: false,
          properties: {
            org_name: { type: "string", minLength: 1, pattern: "\\S" },
          },
          example: { org_name: "Renamed organisation" },
        },
        OrganisationResponse: {
          type: "object",
          required: ["data"],
          properties: { data: { $ref: "#/components/schemas/Organisation" } },
          example: { data: { id: 1, org_name: "Parent" } },
        },
        RelationshipsResponse: {
          type: "object",
          required: ["data", "pagination"],
          properties: {
            data: {
              type: "array",
              items: {
                type: "object",
                required: ["org_name", "relationship_type"],
                properties: {
                  org_name: { type: "string" },
                  relationship_type: {
                    type: "string",
                    enum: ["parent", "sister", "daughter"],
                  },
                },
              },
            },
            pagination: {
              type: "object",
              required: ["limit", "offset", "total_count"],
              properties: {
                limit: { type: "integer", minimum: 1, maximum: 100 },
                offset: { type: "integer", minimum: 0 },
                total_count: { type: "integer", minimum: 0 },
              },
            },
          },
          example: {
            data: [{ org_name: "Parent", relationship_type: "parent" }],
            pagination: { limit: 100, offset: 0, total_count: 1 },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "statusCode", "details"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                statusCode: { type: "integer" },
                details: { type: "object", additionalProperties: true },
              },
            },
          },
          example: {
            error: { ...ERROR_DEFINITIONS.ORGANISATION_NOT_FOUND, details: {} },
          },
        },
      },
      parameters: {
        Id: {
          in: "path",
          name: "id",
          required: true,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: Number.MAX_SAFE_INTEGER,
          },
          example: 1,
        },
        Limit: {
          in: "query",
          name: "limit",
          schema: { type: "integer", minimum: 1, maximum: 100, default: 100 },
          example: 10,
        },
        Offset: {
          in: "query",
          name: "offset",
          description: "Zero-based offset; cannot be combined with page.",
          schema: {
            type: "integer",
            minimum: 0,
            maximum: Number.MAX_SAFE_INTEGER,
            default: 0,
          },
          example: 0,
        },
        Page: {
          in: "query",
          name: "page",
          description:
            "Compatibility alternative to offset: (page - 1) * limit. Clear the offset field when using page (for example, page=2); the computed offset must be a safe integer.",
          schema: {
            type: "integer",
            minimum: 1,
            maximum: Number.MAX_SAFE_INTEGER,
          },
        },
      },
      responses: {
        Organisation: organisationResponse,
        CreatedOrganisation: {
          ...organisationResponse,
          description: "A new root organisation",
          headers: {
            ...organisationResponse.headers,
            Location: {
              schema: { type: "string" },
              example: "/organisations/1",
              description: "URL of the new root organisation",
            },
          },
        },
        Relationships: jsonResponse(
          "Relationships in name/type order; total_count counts all matches before pagination",
          { $ref: "#/components/schemas/RelationshipsResponse" },
        ),
        ValidationError: jsonResponse(
          "Invalid fields or malformed JSON",
          { $ref: "#/components/schemas/ErrorResponse" },
          {
            error: {
              ...ERROR_DEFINITIONS.VALIDATION_ERROR,
              details: {
                issues: [
                  {
                    path: "body.org_name",
                    message: "Organisation name must not be blank",
                  },
                ],
              },
            },
          },
        ),
        NotFound: errorResponse(ERROR_DEFINITIONS.ORGANISATION_NOT_FOUND),
        Conflict: errorResponse(ERROR_DEFINITIONS.CONFLICT),
        PayloadTooLarge: errorResponse(ERROR_DEFINITIONS.PAYLOAD_TOO_LARGE),
        UnsupportedMediaType: errorResponse(
          ERROR_DEFINITIONS.UNSUPPORTED_MEDIA_TYPE,
        ),
        InternalError: errorResponse(ERROR_DEFINITIONS.INTERNAL_ERROR),
        RateLimited: {
          ...errorResponse(ERROR_DEFINITIONS.RATE_LIMITED),
          headers: {
            "X-Request-ID": { schema: { type: "string", format: "uuid" } },
            "Retry-After": {
              schema: { type: "integer" },
              description: "Seconds until retry",
            },
            RateLimit: {
              schema: { type: "string" },
              description: "Remaining budget and reset time (draft 8)",
            },
            "RateLimit-Policy": {
              schema: { type: "string" },
              description: "Mutation rate limit policy",
            },
          },
        },
      },
    },
  },
  // Scan the source or emitted route comments, independent of the working directory.
  apis: [
    fileURLToPath(
      new URL(
        `../routes/*.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`,
        import.meta.url,
      ),
    ),
  ],
});
