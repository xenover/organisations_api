import { rateLimit } from "express-rate-limit";
import { AppError } from "../errors/index.js";
import { ERROR_DEFINITIONS } from "../errors/definitions.js";

// A local in-memory budget per IP for the existing organisation POST endpoint.
export function createPostLimiter(limit = 100, windowMs = 60_000) {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(ERROR_DEFINITIONS.RATE_LIMITED)),
  });
}
