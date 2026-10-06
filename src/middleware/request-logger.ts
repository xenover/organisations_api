import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../utils/logger.js";

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const started = performance.now();
  const context = { requestId, method: req.method, path: req.path };
  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  logger.debug(context, "Request received");
  res.once("finish", () => {
    logger.info(
      {
        ...context,
        statusCode: res.statusCode,
        responseTimeMs: performance.now() - started,
      },
      "Request completed",
    );
  });
  res.once("close", () => {
    if (!res.writableFinished) logger.warn(context, "Request aborted");
  });
  next();
};
