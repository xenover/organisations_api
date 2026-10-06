export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details: Record<string, unknown>;
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    message = "Internal server error",
    readonly statusCode = 500,
    readonly code = "INTERNAL_ERROR",
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(issues: ValidationIssue[]) {
    super("Invalid request", 400, "VALIDATION_ERROR", { issues });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Route not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Request conflicts with the current state") {
    super(message, 409, "CONFLICT");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}
