import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/index.js";
import type { ErrorResponse } from "../errors/index.js";
import { logger } from "../utils/logger.js";

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  // Express's JSON parser raises HTTP errors before route validation runs.
  // Give clients stable messages rather than parser internals or body excerpts.
  if (error instanceof Error && "type" in error) {
    switch (error.type) {
      case "entity.parse.failed":
        return new AppError(
          "Request body must be valid JSON",
          400,
          "INVALID_JSON",
        );
      case "entity.too.large":
        return new AppError(
          "Request body is too large",
          413,
          "PAYLOAD_TOO_LARGE",
        );
      case "encoding.unsupported":
      case "charset.unsupported":
        return new AppError(
          "Unsupported request body encoding",
          415,
          "UNSUPPORTED_MEDIA_TYPE",
        );
      case "request.aborted":
      case "request.size.invalid":
        return new AppError("Invalid request body", 400, "BAD_REQUEST");
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
  const log = {
    err: error,
    method: req.method,
    path: req.path,
    statusCode: normalized.statusCode,
    code: normalized.code,
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
