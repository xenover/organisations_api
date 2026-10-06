import type { RequestHandler } from "express";
import type { ParamsDictionary, Query } from "express-serve-static-core";
import type { z } from "zod";
import { ValidationError } from "../errors/index.js";

// The locals type carries the parsed schema output, including defaults and transforms.
export function validate<Output, Source extends "body" | "query", ResponseBody>(
  schema: z.ZodType<Output>,
  source: Source,
): RequestHandler<
  ParamsDictionary,
  ResponseBody,
  unknown,
  Query,
  Record<Source, Output>
> {
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
    const locals: Record<Source, Output> = res.locals;
    locals[source] = result.data;
    next();
  };
}
