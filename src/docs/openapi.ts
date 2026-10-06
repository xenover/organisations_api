import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";
import { ERROR_DEFINITIONS } from "../errors/definitions.js";

const requestIdHeader = {
  schema: { type: "string", format: "uuid" },
  description: "Request correlation ID",
};
const errorResponse = (definition: {
  code: string;
  message: string;
  statusCode: number;
}) => ({
  description: definition.message,
  headers: { "X-Request-ID": requestIdHeader },
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
      example: { error: { ...definition, details: {} } },
    },
  },
});

export const openApiDocument = swaggerJsdoc({
  failOnErrors: true,
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Organisations API",
      version: "1.0.0",
      description:
        "The original organisation tree creation and name-based relationship lookup API. POST returns 201 with OK; GET returns a JSON array of up to 100 relationships per page. POST is limited to 100 requests per IP per minute.",
    },
    servers: [{ url: "/" }],
    components: {
      schemas: {
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
        Relationships: {
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
          example: [{ org_name: "Parent", relationship_type: "parent" }],
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
            error: {
              ...ERROR_DEFINITIONS.VALIDATION_ERROR,
              details: {
                issues: [
                  {
                    path: "query.name",
                    message: "Organisation name must not be blank",
                  },
                ],
              },
            },
          },
        },
      },
      responses: {
        Relationships: {
          description:
            "Relationships sorted by name. Unknown names and pages beyond the results return an empty array.",
          headers: { "X-Request-ID": requestIdHeader },
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Relationships" },
            },
          },
        },
        ValidationError: {
          ...errorResponse(ERROR_DEFINITIONS.VALIDATION_ERROR),
          description: "Invalid body/query fields or malformed JSON",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                invalidField: {
                  value: {
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
                },
                invalidJson: {
                  value: {
                    error: { ...ERROR_DEFINITIONS.INVALID_JSON, details: {} },
                  },
                },
              },
            },
          },
        },
        PayloadTooLarge: errorResponse(ERROR_DEFINITIONS.PAYLOAD_TOO_LARGE),
        UnsupportedMediaType: errorResponse(
          ERROR_DEFINITIONS.UNSUPPORTED_MEDIA_TYPE,
        ),
        InternalError: errorResponse(ERROR_DEFINITIONS.INTERNAL_ERROR),
        RateLimited: {
          ...errorResponse(ERROR_DEFINITIONS.RATE_LIMITED),
          headers: {
            "X-Request-ID": requestIdHeader,
            "Retry-After": {
              schema: { type: "integer" },
              description: "Seconds until retry",
            },
            RateLimit: {
              schema: { type: "string" },
              description: "Remaining POST budget and reset time (draft 8)",
            },
            "RateLimit-Policy": {
              schema: { type: "string" },
              description: "POST rate limit policy",
            },
          },
        },
      },
    },
  },
  // Scan source or emitted route comments, independent of the working directory.
  apis: [
    fileURLToPath(
      new URL(
        `../routes/*.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`,
        import.meta.url,
      ),
    ),
  ],
});
