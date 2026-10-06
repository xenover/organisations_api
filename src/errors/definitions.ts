export interface ErrorDefinition {
  readonly code: string;
  readonly message: string;
  readonly statusCode: number;
}

export const ERROR_DEFINITIONS = {
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    message: "Internal server error",
    statusCode: 500,
  },
  VALIDATION_ERROR: {
    code: "VALIDATION_ERROR",
    message: "Invalid request",
    statusCode: 400,
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    message: "Route not found",
    statusCode: 404,
  },
  CONFLICT: {
    code: "CONFLICT",
    message: "Request conflicts with the current state",
    statusCode: 409,
  },
  INVALID_JSON: {
    code: "INVALID_JSON",
    message: "Request body must be valid JSON",
    statusCode: 400,
  },
  PAYLOAD_TOO_LARGE: {
    code: "PAYLOAD_TOO_LARGE",
    message: "Request body is too large",
    statusCode: 413,
  },
  UNSUPPORTED_MEDIA_TYPE: {
    code: "UNSUPPORTED_MEDIA_TYPE",
    message: "Unsupported request body encoding",
    statusCode: 415,
  },
  BAD_REQUEST: {
    code: "BAD_REQUEST",
    message: "Invalid request body",
    statusCode: 400,
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Too many POST requests; retry later",
    statusCode: 429,
  },
} as const satisfies Record<string, ErrorDefinition>;

// These identifiers come from Express's body parser.
export const REQUEST_BODY_ERRORS: ReadonlyMap<string, ErrorDefinition> =
  new Map<string, ErrorDefinition>([
    ["entity.parse.failed", ERROR_DEFINITIONS.INVALID_JSON],
    ["entity.too.large", ERROR_DEFINITIONS.PAYLOAD_TOO_LARGE],
    ["encoding.unsupported", ERROR_DEFINITIONS.UNSUPPORTED_MEDIA_TYPE],
    ["charset.unsupported", ERROR_DEFINITIONS.UNSUPPORTED_MEDIA_TYPE],
    ["request.aborted", ERROR_DEFINITIONS.BAD_REQUEST],
    ["request.size.invalid", ERROR_DEFINITIONS.BAD_REQUEST],
  ]);
