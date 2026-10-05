import express from "express";
import helmet from "helmet";
import appRouter from "./src/routes/index.js";
import type { Server } from "node:http";
import { env } from "./src/config/env.js";
import { logger } from "./src/utils/logger.js";

const app = express();

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

const server: Server = app.listen(env.PORT, () => {
  const address = server.address();
  if (address && typeof address !== "string") {
    logger.info({ port: address.port }, "Server started up");
  }
});

export default server;
