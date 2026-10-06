import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import appRouter from "./routes/index.js";
import { NotFoundError } from "./errors/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";

export default function createApp({
  corsOrigins = env.CORS_ORIGINS,
}: { corsOrigins?: string[] } = {}) {
  const app = express();
  app.use(requestLogger);

  app.use(
    helmet({
      strictTransportSecurity: false,
      contentSecurityPolicy: {
        directives: { "upgrade-insecure-requests": null },
      },
    }),
  );
  app.use(
    cors({
      origin: corsOrigins,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type"],
      exposedHeaders: ["X-Request-ID"],
      credentials: false,
    }),
  );
  app.use(express.json());

  appRouter(app);

  app.use((_req, _res, next) => next(new NotFoundError()));
  app.use(errorHandler);

  return app;
}
