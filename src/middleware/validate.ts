import type { RequestHandler } from "express";
import type { z } from "zod";
import { ValidationError } from "../errors/index.js";

export function validate(
  schema: z.ZodType,
  source: "body" | "query",
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(
        new ValidationError(
          result.error.issues.map((issue) => ({
            path: [source, ...issue.path].map(String).join("."),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    // Express 5's req.query is a getter; keep parsed values in response locals.
    res.locals[source] = result.data;
    next();
  };
}
