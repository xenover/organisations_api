import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/index.js";
import type { ErrorResponse } from "../errors/index.js";
import { REQUEST_BODY_ERRORS } from "../errors/definitions.js";
import { logger } from "../utils/logger.js";

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  // Express's JSON parser raises HTTP errors before route validation runs.
  // Give clients stable messages rather than parser internals or body excerpts.
  if (
    error instanceof Error &&
    "type" in error &&
    typeof error.type === "string"
  ) {
    const definition = REQUEST_BODY_ERRORS.get(error.type);
    if (definition) {
      return new AppError(definition);
    }
  }

  return new AppError();
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  next,
) => {
  const normalized = normalizeError(error);
  const bodyParserFailure =
    error instanceof Error &&
    "type" in error &&
    typeof error.type === "string" &&
    REQUEST_BODY_ERRORS.has(error.type);
  const log = {
    // Parser errors can carry raw bodies and include body excerpts in their stacks.
    err: bodyParserFailure ? normalized : error,
    method: req.method,
    path: req.path,
    statusCode: normalized.statusCode,
    code: normalized.code,
    requestId: res.locals.requestId,
  };
  if (normalized.statusCode >= 500) {
    logger.error(log, "Request failed");
  } else {
    logger.warn(log, "Request failed");
  }

  // Once a response has started, Express must finish handling the connection.
  if (res.headersSent) {
    next(error);
    return;
  }

  const response: ErrorResponse = {
    error: {
      code: normalized.code,
      message: normalized.message,
      statusCode: normalized.statusCode,
      details: normalized.details,
    },
  };
  res.status(normalized.statusCode).json(response);
};
