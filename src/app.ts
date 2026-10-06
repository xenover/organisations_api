import express from "express";
import helmet from "helmet";
import appRouter from "./routes/index.js";
import { NotFoundError } from "./errors/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";

export default function createApp() {
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
  app.use(express.json());

  appRouter(app);

  app.use((_req, _res, next) => next(new NotFoundError()));
  app.use(errorHandler);

  return app;
}
