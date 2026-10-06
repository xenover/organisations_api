import express from "express";
import helmet from "helmet";
import appRouter from "./src/routes/index.js";
import type { Server } from "node:http";
import { env } from "./src/config/env.js";
import { logger } from "./src/utils/logger.js";
import { NotFoundError } from "./src/errors/index.js";
import { errorHandler } from "./src/middleware/error-handler.js";
import { requestLogger } from "./src/middleware/request-logger.js";

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

const server: Server = app.listen(env.PORT, () => {
  const address = server.address();
  if (address && typeof address !== "string") {
    logger.info({ port: address.port }, "Server started up");
  }
});

export default server;
