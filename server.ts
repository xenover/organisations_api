import createApp from "./src/app.js";
import type { Server } from "node:http";
import { env } from "./src/config/env.js";
import { logger } from "./src/utils/logger.js";

const app = createApp();
const server: Server = app.listen(env.PORT, () => {
  const address = server.address();
  if (address && typeof address !== "string") {
    logger.info({ port: address.port }, "Server started up");
  }
});

export default server;
