import type { RequestHandler } from "express";
import type { z } from "zod";

export interface ValidationErrorResponse {
  error: string;
  issues: { path: string; message: string }[];
}

export function validate(
  schema: z.ZodType,
  source: "body" | "query",
): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const response: ValidationErrorResponse = {
        error: "Invalid request",
        issues: result.error.issues.map((issue) => ({
          path: [source, ...issue.path].map(String).join("."),
          message: issue.message,
        })),
      };
      res.status(400).json(response);
      return;
    }

    // Express 5's req.query is a getter; keep parsed values in response locals.
    res.locals[source] = result.data;
    next();
  };
}
