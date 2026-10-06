import { ERROR_DEFINITIONS } from "./definitions.js";
import type { ErrorDefinition } from "./definitions.js";

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
  readonly statusCode: number;
  readonly code: string;

  constructor(
    definition: ErrorDefinition = ERROR_DEFINITIONS.INTERNAL_ERROR,
    readonly details: Record<string, unknown> = {},
  ) {
    super(definition.message);
    this.name = new.target.name;
    this.statusCode = definition.statusCode;
    this.code = definition.code;
  }
}

export class ValidationError extends AppError {
  constructor(issues: ValidationIssue[]) {
    super(ERROR_DEFINITIONS.VALIDATION_ERROR, { issues });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = ERROR_DEFINITIONS.NOT_FOUND.message) {
    super({ ...ERROR_DEFINITIONS.NOT_FOUND, message });
  }
}

export class ConflictError extends AppError {
  constructor(message: string = ERROR_DEFINITIONS.CONFLICT.message) {
    super({ ...ERROR_DEFINITIONS.CONFLICT, message });
  }
}
